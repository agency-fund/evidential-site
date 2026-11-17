/** Builds the site and serves it, with the contact Worker, through `wrangler dev` for the walkthrough. */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

// Cloudflare's Turnstile test secret: every token passes, and wrangler dev only simulates email delivery.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export interface RunningSite {
  url: string;
  stop: () => void;
}

/** Builds dist/ as production so the walkthrough shows what visitors get (consent banner included). */
export function buildSite(siteDir: string): void {
  const result = spawnSync("pnpm", ["exec", "astro", "build"], {
    cwd: siteDir,
    // The real Turnstile widget only accepts www.evidential.dev and evidential.dev; locally, use the test key that
    // matches the test secret below.
    env: { ...process.env, DEPLOY_ENV: "production", TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error("astro build failed");
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject()));
    });
  });
}

async function waitUntilReady(url: string, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited early:\n${log()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`wrangler dev did not become ready:\n${log()}`);
}

export async function serveSite(siteDir: string): Promise<RunningSite> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const child = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--var",
      `TURNSTILE_SECRET:${TURNSTILE_TEST_SECRET}`,
      "--show-interactive-dev-session=false",
    ],
    { cwd: siteDir, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk));
  const stop = () => {
    // wrangler spawns workerd; signal the whole process group.
    if (child.pid && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
  };
  try {
    await waitUntilReady(url, child, () => output);
  } catch (error) {
    stop();
    throw error;
  }
  return { url, stop };
}
