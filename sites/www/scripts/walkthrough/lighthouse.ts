/**
 * Runs Lighthouse against the locally served site and saves an image of the report's score summary and
 * performance section. Three runs are made and the one with the median performance score is kept, as Lighthouse CI
 * does.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";

const RUNS = 3;
// Keep test runs out of real analytics.
const BLOCKED_URL_PATTERNS = ["*googletagmanager.com*", "*google-analytics.com*", "*cloudflareinsights.com*"];

function runLighthouse(siteDir: string, url: string, outputBase: string): void {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "lighthouse",
      url,
      "--quiet",
      "--output=json",
      "--output=html",
      `--output-path=${outputBase}`,
      "--chrome-flags=--headless=new --no-sandbox",
      ...BLOCKED_URL_PATTERNS.map((pattern) => `--blocked-url-patterns=${pattern}`),
    ],
    { cwd: siteDir, encoding: "utf8", env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error("lighthouse failed");
  }
}

export async function renderLighthouseReport(
  browser: Browser,
  siteDir: string,
  url: string,
  outFile: string,
): Promise<number> {
  const workDir = await mkdtemp(path.join(tmpdir(), "evidential-lighthouse-"));
  try {
    const runs: Array<{ score: number; html: string }> = [];
    for (let i = 0; i < RUNS; i++) {
      const base = path.join(workDir, `run-${i}`);
      runLighthouse(siteDir, url, base);
      const report = JSON.parse(await readFile(`${base}.report.json`, "utf8")) as {
        categories: { performance: { score: number } };
      };
      runs.push({ score: report.categories.performance.score, html: `${base}.report.html` });
    }
    runs.sort((a, b) => a.score - b.score);
    const median = runs[Math.floor(runs.length / 2)]!;

    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(`file://${median.html}`);
    const performance = page.locator(".lh-category").first();
    await performance.waitFor();
    // Let the gauges finish animating.
    await page.waitForTimeout(1500);
    const bottom = await performance.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.ceil(bottom) } });
    await page.close();
    await sharp(png).webp({ quality: 90 }).toFile(outFile);
    return median.score;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
