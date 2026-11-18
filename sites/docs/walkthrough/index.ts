/**
 * Produces shareable artifacts for the current state of the docs, like sites/www's walkthrough:
 *
 *   walkthrough.mp4         30-second 1280x1024 H.264 tour of the docs and the API reference
 *   share-previews.webp     the home page's link preview in WhatsApp, Substack, Telegram, LinkedIn, Facebook, Instagram
 *
 * Usage (from sites/docs): node walkthrough/index.ts [--out <dir>] [--only video,cards]
 * Writes to sites/docs/walkthrough/output/ by default. Requires ffmpeg with libx264 on PATH and Playwright's Chromium
 * (`pnpm exec playwright install chromium`).
 *
 * The recorder and share-card modules are sites/www's (sites/www/scripts/walkthrough/), so both sites'
 * artifacts are made the same way, including its font rendering fixes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { launchChromium } from "../../www/scripts/walkthrough/recorder.ts";
import { renderShareCards } from "../../www/scripts/walkthrough/share-cards.ts";
import { buildSite, serveSite } from "./site.ts";
import { recordTour } from "./video.ts";

const VIDEO_SECONDS = 30;
const ARTIFACTS = ["video", "cards"] as const;
type Artifact = (typeof ARTIFACTS)[number];

const siteDir = path.resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: {
    out: { type: "string", default: path.join(import.meta.dirname, "output") },
    only: { type: "string", default: ARTIFACTS.join(",") },
  },
});
const outDir = path.resolve(values.out);
const only = new Set(values.only.split(",").map((name) => name.trim()));
for (const name of only) {
  if (!(ARTIFACTS as readonly string[]).includes(name))
    throw new Error(`Unknown artefact "${name}"`);
}
const wanted = (name: Artifact) => only.has(name);

await mkdir(outDir, { recursive: true });
// Generated files are for sharing, not for committing.
await writeFile(path.join(outDir, ".gitignore"), "*\n");

console.log("Building the docs…");
buildSite(siteDir);
const site = await serveSite(siteDir);
const browser = await launchChromium();
try {
  if (wanted("video")) {
    const file = path.join(outDir, "walkthrough.mp4");
    console.log(`Recording ${VIDEO_SECONDS}s tour of ${site.url}…`);
    await recordTour(browser, site.url, file, VIDEO_SECONDS);
    console.log(`  wrote ${file}`);
  }
  if (wanted("cards")) {
    const file = path.join(outDir, "share-previews.webp");
    await renderShareCards(browser, path.join(siteDir, "dist"), file, {
      post: "The Evidential docs cover integrating with the API and running experiments:",
      caption: "Evidential's documentation and API reference.",
    });
    console.log(`  wrote ${file}`);
  }
} finally {
  await browser.close();
  site.stop();
}
