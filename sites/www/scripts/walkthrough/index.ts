/**
 * Produces shareable artifacts for the current state of the site:
 *
 *   walkthrough.mp4         2-minute 1280x1024 H.264 video demonstrating every interactive feature
 *   share-previews.webp     the page's link preview in WhatsApp, Substack, Telegram, LinkedIn, Facebook, Instagram
 *   lighthouse.webp         Lighthouse score summary and performance report
 *
 * Usage (from sites/www): node scripts/walkthrough/index.ts [--out <dir>] [--only video,cards,lighthouse]
 * Requires ffmpeg with libx264 on PATH and Playwright's Chromium (`pnpm exec playwright install chromium`).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { renderLighthouseReport } from "./lighthouse.ts";
import { renderShareCards } from "./share-cards.ts";
import { buildSite, serveSite } from "./site.ts";
import { recordWalkthrough } from "./video.ts";

const VIDEO_SECONDS = 120;
const ARTIFACTS = ["video", "cards", "lighthouse"] as const;
type Artifact = (typeof ARTIFACTS)[number];

const siteDir = path.resolve(import.meta.dirname, "../..");
const { values } = parseArgs({
  options: {
    out: { type: "string", default: path.resolve(siteDir, "../../walkthrough") },
    only: { type: "string", default: ARTIFACTS.join(",") },
  },
});
const outDir = path.resolve(values.out);
const only = new Set(values.only.split(",").map((name) => name.trim()));
for (const name of only) {
  if (!(ARTIFACTS as readonly string[]).includes(name)) throw new Error(`Unknown artifact "${name}"`);
}
const wanted = (name: Artifact) => only.has(name);

await mkdir(outDir, { recursive: true });
// Generated files are for sharing, not for committing.
await writeFile(path.join(outDir, ".gitignore"), "*\n");

console.log("Building the site (DEPLOY_ENV=production)…");
buildSite(siteDir);
console.log("Starting wrangler dev…");
const site = await serveSite(siteDir);
// Headless Chromium on Linux defaults to full font hinting, which runs FreeType's auto-hinter on unhinted web fonts
// like Inter and visibly distorts letter spacing ("Alr eady"). Render text the way desktop browsers do, in grayscale so
// subpixel color fringes don't smear in the compressed video.
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
try {
  if (wanted("video")) {
    const file = path.join(outDir, "walkthrough.mp4");
    console.log(`Recording ${VIDEO_SECONDS}s walkthrough of ${site.url}…`);
    await recordWalkthrough(browser, site.url, file, VIDEO_SECONDS);
    console.log(`  wrote ${file}`);
  }
  if (wanted("cards")) {
    const file = path.join(outDir, "share-previews.webp");
    await renderShareCards(browser, path.join(siteDir, "dist"), file);
    console.log(`  wrote ${file}`);
  }
  if (wanted("lighthouse")) {
    const file = path.join(outDir, "lighthouse.webp");
    console.log("Running Lighthouse (3 runs)…");
    const score = await renderLighthouseReport(browser, siteDir, site.url, file);
    console.log(`  wrote ${file} (median performance score ${Math.round(score * 100)})`);
  }
} finally {
  await browser.close();
  site.stop();
}
