/**
 * Records a page to H.264 MP4 at a constant frame rate. Chromium's screencast only emits a frame when something on
 * screen changes, so each frame is repeated until the next one arrives, and the output is padded or trimmed to an
 * exact duration.
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import type { Page } from "playwright";

export interface Recording {
  /** Seconds since the first frame (0 before recording starts). */
  elapsed: () => number;
  /** Stops capturing and finishes the MP4. */
  finish: () => Promise<void>;
  /** Stops capturing and discards the partial MP4. */
  abort: () => Promise<void>;
}

export async function startRecording(
  page: Page,
  outFile: string,
  { width, height, fps, durationSeconds }: { width: number; height: number; fps: number; durationSeconds: number },
): Promise<Recording> {
  const totalFrames = Math.round(durationSeconds * fps);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "-",
      "-vf",
      // Screencast JPEGs are full range; convert to the limited-range yuv420p that every player expects.
      `scale=${width}:${height}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p`,
      "-color_range",
      "tv",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-profile:v",
      "high",
      "-movflags",
      "+faststart",
      "-frames:v",
      String(totalFrames),
      outFile,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  ffmpeg.on("error", (error) => {
    throw new Error(`Could not run ffmpeg (is it installed?): ${error.message}`);
  });
  const exited = new Promise<void>((resolve, reject) =>
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
  );

  let startedAt: number | undefined;
  let lastFrame: Buffer | undefined;
  let written = 0;

  const write = (frame: Buffer) => {
    if (written >= totalFrames) return;
    ffmpeg.stdin.write(frame);
    written++;
  };
  // Repeats the most recent frame until the output catches up with wall-clock time.
  const catchUp = (now: number) => {
    if (startedAt === undefined || !lastFrame) return;
    const due = Math.min(totalFrames, Math.floor(((now - startedAt) / 1000) * fps));
    while (written < due) write(lastFrame);
  };

  await page.screencast.start({
    size: { width, height },
    quality: 92,
    onFrame: ({ data }) => {
      const now = performance.now();
      startedAt ??= now;
      catchUp(now);
      lastFrame = data;
    },
  });
  // Keep the timeline moving through stretches where nothing on screen changes.
  const ticker = setInterval(() => catchUp(performance.now()), 1000 / fps);

  return {
    elapsed: () => (startedAt === undefined ? 0 : (performance.now() - startedAt) / 1000),
    finish: async () => {
      clearInterval(ticker);
      await page.screencast.stop();
      catchUp(performance.now());
      if (written < totalFrames && lastFrame) {
        // Hold the final frame so the video is exactly `durationSeconds` long.
        while (written < totalFrames) write(lastFrame);
      }
      ffmpeg.stdin.end();
      await exited;
    },
    abort: async () => {
      clearInterval(ticker);
      await page.screencast.stop().catch(() => undefined);
      ffmpeg.kill("SIGKILL");
      await exited.catch(() => undefined);
      await rm(outFile, { force: true });
    },
  };
}
