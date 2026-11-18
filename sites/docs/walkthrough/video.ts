/**
 * Records a 30-second tour of the docs: the home page, a page with an expandable section and a diagram, search across
 * the docs and the API reference, an API operation, and dark mode. Each step has a target start time so the video
 * stays paced at its length even if a step finishes early.
 */
import type { Browser, Page } from "playwright";
import { startRecording } from "../../www/scripts/walkthrough/recorder.ts";
import {
  CAPTION_STYLE,
  CURSOR,
  scrollTo,
  sleep,
} from "../../www/scripts/walkthrough/video.ts";

const WIDTH = 1280;
const HEIGHT = 1024;
const FPS = 30;

export async function recordTour(
  browser: Browser,
  url: string,
  outFile: string,
  durationSeconds: number,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto("about:blank");

  const recording = await startRecording(page, outFile, {
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationSeconds,
  });
  /** Waits until `seconds` into the video so every step starts on schedule. */
  const until = async (seconds: number) => {
    const remaining = seconds - recording.elapsed();
    if (remaining > 0) await sleep(remaining * 1000);
    else if (remaining < -1)
      console.warn(
        `  tour is ${(-remaining).toFixed(1)}s behind schedule at ${seconds}s`,
      );
  };
  let caption: { dispose: () => Promise<void> } | undefined;
  const say = async (text: string) => {
    await caption?.dispose();
    caption = await page.screencast.showOverlay(
      `<div style="${CAPTION_STYLE}">${text}</div>`,
    );
  };
  try {
    await page.screencast.showActions(CURSOR);

    // Home.
    await page.goto(url, { waitUntil: "networkidle" });
    await say("The Evidential docs, rebuilt with Nimbus");
    await until(3.5);

    // The sidebar, then a page with an accordion and a diagram.
    await say("Guides for users and developers");
    await page
      .locator("[data-nb-sidebar] a[href='/develop/concepts/background-workers/']")
      .click();
    await page.waitForURL("**/develop/concepts/background-workers/");
    await until(7);
    await scrollTo(page, "#task-queue", 1300);
    await say("Expandable sections and Mermaid diagrams");
    await page.getByText("Implementation Details", { exact: true }).click();
    const diagram = page.locator(".mermaid-container").first();
    await diagram.waitFor();
    await sleep(700);
    // Diagrams open full-screen, where their labels are legible.
    await diagram.hover();
    await diagram.locator(".mermaid-expand").click();
    await sleep(2200);
    await page.keyboard.press("Escape");
    await until(14);

    // Search across the docs and the API reference.
    await say("Search the docs and the API reference");
    await page.keyboard.press("Control+k");
    await page
      .locator("dialog[open] input[data-search-input]")
      .pressSequentially("outcome", { delay: 120 });
    const result = page.locator(
      "dialog[open] [role=option] a[href='/api/outcomes/record/']",
    );
    await result.waitFor();
    await sleep(900);
    await result.hover();
    await sleep(500);
    await result.click();
    await page.waitForURL("**/api/outcomes/record/");
    await until(20);

    // An API operation.
    await say("An API reference generated from the OpenAPI spec");
    await sleep(900);
    await page
      .locator("select.nb-cr-langselect")
      .selectOption({ label: "Python" });
    await sleep(1500);
    await page.locator("button.nb-cr-respbtn", { hasText: "422" }).click();
    await sleep(1200);
    await page.locator("button.nb-cr-respbtn", { hasText: "200" }).click();
    await until(26);

    // Dark mode.
    await say("Light and dark themes");
    await page.locator("button[data-nb-theme-toggle]").click();
    await until(28.5);
    await say("docs.evidential.dev");
    await until(durationSeconds);
  } catch (error) {
    await recording.abort();
    await context.close();
    throw error;
  }
  await recording.finish();
  await context.close();
}
