/**
 * Records a narrated walkthrough of every interactive feature on the home page, top to bottom, followed by the
 * mobile menu. Each section has a target start time so the video stays paced at the requested length even if a
 * step finishes early.
 */
import type { Browser, FrameLocator, Locator, Page } from "playwright";
import { startRecording } from "./recorder.ts";

const WIDTH = 1280;
const HEIGHT = 1024;
const FPS = 30;

/** Requests the walkthrough must not make: real analytics would record the demo as visits. */
export const BLOCKED_HOSTS = /googletagmanager\.com|google-analytics\.com|cloudflareinsights\.com/;

const CAPTION_STYLE = [
  "position:fixed",
  "left:50%",
  "bottom:28px",
  "transform:translateX(-50%)",
  "padding:10px 18px",
  "border-radius:999px",
  "background:rgba(0,21,43,.88)",
  "color:#fff",
  "font:600 17px/1.3 Inter,system-ui,sans-serif",
  "letter-spacing:.01em",
  "box-shadow:0 8px 24px rgba(0,0,0,.25)",
  "white-space:nowrap",
].join(";");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scrolls with an ease-in-out curve so viewers can follow along (the page's own smooth scroll is too quick). */
async function scrollTo(page: Page, target: string | "top" | "bottom", durationMs = 1400): Promise<void> {
  await page.evaluate(
    async ({ target, durationMs }) => {
      const root = document.documentElement;
      const start = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      let end: number;
      if (target === "top") end = 0;
      else if (target === "bottom") end = max;
      else {
        const element = document.querySelector(target);
        if (!element) throw new Error(`No element matches ${target}`);
        // Land just below the sticky header.
        const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        end = element.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      }
      end = Math.max(0, Math.min(max, end));
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      const began = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          const t = Math.min(1, (now - began) / durationMs);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          window.scrollTo(0, start + (end - start) * eased);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      root.style.scrollBehavior = previous;
    },
    { target, durationMs },
  );
}

async function hoverEach(locators: Locator[], dwellMs: number): Promise<void> {
  for (const locator of locators) {
    await locator.hover();
    await sleep(dwellMs);
  }
}

function phoneFrameHtml(url: string): string {
  return `<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;
    background:radial-gradient(circle at 30% 20%,#0a4a8a,#000f1a 70%)">
    <div style="padding:14px;border-radius:52px;background:#0b0f14;box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 0 0 2px #2a313a">
      <iframe src="${url}" title="Evidential on a phone" style="display:block;width:390px;height:844px;border:0;border-radius:40px;background:#fff"></iframe>
    </div></body></html>`;
}

export async function recordWalkthrough(
  browser: Browser,
  url: string,
  outFile: string,
  durationSeconds: number,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  await context.route(BLOCKED_HOSTS, (route) => route.abort());
  const page = await context.newPage();
  // The site forbids being framed (X-Frame-Options, CSP frame-ancestors). Relax that only for the phone-frame
  // iframe used in the mobile segment.
  await context.route(`${url}**`, async (route) => {
    const request = route.request();
    if (request.resourceType() !== "document" || request.frame() === page.mainFrame()) return route.fallback();
    const response = await route.fetch();
    const headers = response.headers();
    delete headers["x-frame-options"];
    delete headers["content-security-policy"];
    return route.fulfill({ response, headers });
  });
  page.setDefaultTimeout(15_000);
  await page.goto("about:blank");

  const recording = await startRecording(page, outFile, { width: WIDTH, height: HEIGHT, fps: FPS, durationSeconds });
  /** Waits until `seconds` into the video so every section starts on schedule. */
  const until = async (seconds: number) => {
    const remaining = seconds - recording.elapsed();
    if (remaining > 0) await sleep(remaining * 1000);
    else if (remaining < -1)
      console.warn(`  walkthrough is ${(-remaining).toFixed(1)}s behind schedule at ${seconds}s`);
  };
  let caption: { dispose: () => Promise<void> } | undefined;
  const say = async (text: string) => {
    await caption?.dispose();
    caption = await page.screencast.showOverlay(`<div style="${CAPTION_STYLE}">${text}</div>`);
  };
  try {
    await page.screencast.showActions({
      cursor: "pointer",
      duration: 450,
      style: {
        point:
          "width:34px;height:34px;border-radius:50%;border:3px solid rgba(212,158,0,.95);background:rgba(212,158,0,.18)",
        title: "display:none",
      },
    });

    // Hero: headline animation, rotating console screenshots, consent banner.
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // Dismiss the consent banner first so it doesn't sit under the captions.
    await sleep(1200);
    await page.locator(".consent [data-consent=granted]").click();
    await say("Headline animation and rotating product screenshots");
    await until(5.5);
    await say("Navigation and calls to action");
    await hoverEach(await page.locator("header .navlinks a").all(), 280);
    await hoverEach(
      [page.locator(".navcta .login"), page.locator(".navcta .btn"), page.locator(".hero-cta .btn").nth(1)],
      450,
    );
    await until(11);

    await scrollTo(page, ".hero .shotwrap", 1200);
    await say("Screenshots rotate every 5 seconds, with a pause control");
    const heroToggle = page.locator(".hero .rotate-toggle");
    await heroToggle.click();
    await sleep(1800);
    await heroToggle.click();
    await page.mouse.move(80, 500, { steps: 12 });
    await until(20);

    // Partner marquee.
    // The stats come into view with the marquee, which is when their numbers roll in.
    await say("Impact numbers roll in; partner logos scroll and pause on hover");
    await scrollTo(page, ".trust", 1200);
    await sleep(2200);
    await page.locator(".marquee").hover();
    await sleep(2200);
    await page.mouse.move(640, 980, { steps: 10 });
    await until(26);

    // Testimonials.
    await say("Testimonials rotate, with arrows, dots, and a pause control");
    await scrollTo(page, "#experiments", 1500);
    await until(30.5);
    const quotes = page.locator(".quotes3");
    await quotes.locator("[data-step='1']").click();
    await sleep(1300);
    await quotes.locator(".qdot").nth(2).click();
    await sleep(1300);
    await quotes.locator("[data-step='-1']").click();
    await sleep(1200);
    await quotes.locator(".rotate-toggle").click();
    await sleep(1200);
    await quotes.locator(".rotate-toggle").click();
    await until(38);

    // Photo strip.
    await scrollTo(page, ".photoband", 1200);
    await say("Photo strip scrolls with the arrow buttons");
    const photos = page.locator(".photoband");
    await photos.locator(".parrow.next").click();
    await sleep(1300);
    await photos.locator(".parrow.next").click();
    await sleep(1300);
    await photos.locator(".parrow.prev").click();
    await until(44);

    // Why Evidential and comparison table.
    await scrollTo(page, "#why", 1400);
    await say("Why Evidential, and how it compares");
    await hoverEach(await page.locator(".why-list li").all(), 400);
    await scrollTo(page, "#why table.cmp", 1200);
    await until(51);

    // Partner results.
    await scrollTo(page, "#partner-tests", 1400);
    await say("Results partners have measured");
    await hoverEach([page.locator(".exp-lead"), ...(await page.locator(".exp").all())], 750);
    await until(57);

    // Five steps.
    await scrollTo(page, "#how", 1300);
    await say("From idea to insight in five steps");
    await hoverEach(await page.locator(".step").all(), 400);
    await until(62);

    // Demo video link.
    await scrollTo(page, ".demo-band", 1200);
    await say("Demo video link (opens YouTube)");
    await page.locator(".demo-embed .ph-inner").hover();
    await until(66);

    // Feature picker.
    await scrollTo(page, "#features", 1300);
    await say("Feature picker: hover or click a method to preview it");
    await hoverEach(await page.locator(".frow").all(), 1350);
    await until(76);

    // Readiness selector.
    await scrollTo(page, "#readiness", 1300);
    await say("Where are you starting from? Each option explains the support and cost");
    for (const index of [1, 2, 0]) {
      await page.locator(".opt").nth(index).click();
      await sleep(1300);
    }
    await page.locator(".ready-cta .btn").hover();
    await until(83);

    // Contact form.
    await scrollTo(page, "#cta", 1400);
    await say("Contact form: validation, bot check, and delivery by the Worker");
    const form = page.locator("#cta .form");
    await form.locator("button[type=submit]").click();
    await sleep(1600);
    await form.locator("#cf-name").pressSequentially("Ada Lovelace", { delay: 45 });
    await form.locator("#cf-email").pressSequentially("ada@example.org", { delay: 35 });
    await form.locator("#cf-org").pressSequentially("Analytical Engines Trust", { delay: 35 });
    await form.locator("#cf-start").selectOption("Our data needs some work");
    await form.locator("#cf-message").pressSequentially("Which SMS reminder time gets more parents to reply?", {
      delay: 22,
    });
    await form.locator("button[type=submit]").click();
    await page.locator("#cta .form-done").waitFor({ timeout: 25_000 });
    await say("The form is replaced by a confirmation (locally, delivery is simulated)");
    await until(100);

    // Footer and in-page navigation.
    await scrollTo(page, "bottom", 1400);
    await say("Footer links");
    await hoverEach((await page.locator("footer a").all()).slice(0, 4), 350);
    await scrollTo(page, "top", 1800);
    await say("Header links jump to each section");
    await page.locator("header .navlinks a", { hasText: "How it works" }).click();
    await until(110);

    // Mobile: the same page in a phone-sized frame, with the menu.
    await caption?.dispose();
    caption = undefined;
    // Start from a fresh document: setContent() would keep the site's CSP, whose frame-src blocks the iframe.
    await page.goto("about:blank");
    await page.setContent(phoneFrameHtml(url));
    const phone: FrameLocator = page.frameLocator("iframe");
    await phone.locator(".hero .tag").waitFor();
    await say("On phones, the navigation moves into a menu");
    await sleep(1500);
    await phone.locator(".burger").click();
    await sleep(1600);
    await phone.locator(".mlinks a", { hasText: "Experiments" }).click();
    await sleep(1800);
    await say("www.evidential.dev");
    await until(durationSeconds);
  } catch (error) {
    await recording.abort();
    await context.close();
    throw error;
  }
  await recording.finish();
  await context.close();
}
