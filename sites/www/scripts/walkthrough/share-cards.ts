/**
 * Renders approximate link previews of the home page as they appear when shared in WhatsApp, Substack, Telegram,
 * LinkedIn, Facebook, and Instagram. Everything comes from the built page's Open Graph tags and image, so the
 * previews follow any metadata change. The mockups imitate each app's light theme; they are not pixel-exact.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright";
import sharp from "sharp";

/** The words around the link in the mockups that show a post: Substack's paragraph and LinkedIn's and Facebook's text. */
export interface ShareCardText {
  post: string;
  caption: string;
}

interface OpenGraph {
  title: string;
  description: string;
  siteName: string;
  domain: string;
  image: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function metaContent(html: string, property: string): string {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`));
  if (!match?.[1]) throw new Error(`Built page has no ${property} meta tag`);
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

async function readOpenGraph(distDir: string): Promise<OpenGraph> {
  const html = await readFile(path.join(distDir, "index.html"), "utf8");
  const imageUrl = new URL(metaContent(html, "og:image"));
  const imageFile = await readFile(path.join(distDir, imageUrl.pathname));
  return {
    title: metaContent(html, "og:title"),
    description: metaContent(html, "og:description"),
    siteName: metaContent(html, "og:site_name"),
    domain: new URL(metaContent(html, "og:url")).hostname,
    image: `data:image/png;base64,${imageFile.toString("base64")}`,
  };
}

function cardsHtml(og: OpenGraph, text: ShareCardText): string {
  const title = escapeHtml(og.title);
  const description = escapeHtml(og.description);
  const site = escapeHtml(og.siteName);
  const domain = escapeHtml(og.domain);
  const bareDomain = domain.replace(/^www\./, "");
  const link = `https://${domain}`;
  const img = `<img src="${og.image}" alt="">`;
  const post = escapeHtml(text.post);
  const caption = escapeHtml(text.caption);
  return `<!doctype html><html><head><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 36px; width: 1440px; background: #e9edf1; font-family: Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; }
  h1 { margin: 0 0 4px; font-size: 26px; } .lede { margin: 0 0 26px; color: #4d565f; font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
  .panel { background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,15,26,.10); display: flex; flex-direction: column; }
  .label { display: flex; align-items: center; gap: 10px; padding: 14px 18px; font-weight: 700; font-size: 16px; border-bottom: 1px solid #e2e7ec; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  .stage { flex: 1; padding: 22px; display: flex; flex-direction: column; justify-content: center; }
  .clamp1, .clamp2, .clamp3 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
  .clamp1 { -webkit-line-clamp: 1; } .clamp2 { -webkit-line-clamp: 2; } .clamp3 { -webkit-line-clamp: 3; }
  img { display: block; width: 100%; aspect-ratio: 1200/630; object-fit: cover; }
  .note { margin-top: 10px; font-size: 12px; color: #6b7883; text-align: center; }

  .wa .stage { background: #efeae2; }
  .wa .bubble { margin-left: auto; width: 88%; background: #d9fdd3; border-radius: 10px 0 10px 10px; padding: 4px; box-shadow: 0 1px 1px rgba(0,0,0,.12); }
  .wa .preview { background: #d1f4cc; border-radius: 7px; overflow: hidden; }
  .wa .meta { padding: 8px 10px; } .wa .t { font-weight: 600; font-size: 14px; } .wa .d { font-size: 13px; color: #555; margin-top: 2px; } .wa .u { font-size: 12px; color: #667781; margin-top: 4px; }
  .wa .msg { padding: 6px 6px 2px; font-size: 14px; color: #027eb5; } .wa .time { text-align: right; font-size: 11px; color: #667781; padding: 0 6px 2px; }

  .ss .stage { background: #fff; }
  .ss .byline { font-size: 13px; color: #777; margin-bottom: 12px; } .ss p { font: 17px/1.55 Georgia, serif; margin: 0 0 14px; color: #363737; }
  .ss .embed { border: 1px solid #e6e6e6; border-radius: 8px; overflow: hidden; }
  .ss .meta { padding: 14px 16px; } .ss .t { font: 700 17px/1.3 Georgia, serif; } .ss .d { font-size: 14px; color: #6b6b6b; margin-top: 6px; } .ss .u { font-size: 13px; color: #9b9b9b; margin-top: 8px; }

  .tg .stage { background: linear-gradient(135deg, #b5d39a, #d4e5a6 45%, #9fc78d); }
  .tg .bubble { margin-left: auto; width: 88%; background: #effdde; border-radius: 16px 16px 4px 16px; padding: 8px 10px 6px; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
  .tg .msg { color: #168acd; font-size: 14px; margin-bottom: 6px; }
  .tg .preview { border-left: 3px solid #4fae4e; padding-left: 9px; } .tg .s { color: #4fae4e; font-weight: 600; font-size: 14px; } .tg .t { font-weight: 600; font-size: 14px; margin-top: 2px; } .tg .d { font-size: 13.5px; margin-top: 2px; }
  .tg .preview img { border-radius: 8px; margin-top: 8px; } .tg .time { text-align: right; font-size: 11px; color: #5fa756; margin-top: 4px; }

  .li .stage { background: #f4f2ee; } .li .post { background: #fff; border-radius: 10px; border: 1px solid #e0dfdc; overflow: hidden; }
  .li .author, .fb .author { display: flex; gap: 10px; align-items: center; padding: 12px 14px 8px; }
  .avatar { width: 40px; height: 40px; border-radius: 8px; background: #003366; color: #d49e00; display: grid; place-items: center; font-weight: 800; }
  .fb .avatar { border-radius: 50%; }
  .name { font-weight: 600; font-size: 14px; } .sub { font-size: 12px; color: #666; }
  .li .text, .fb .text { padding: 0 14px 10px; font-size: 14px; }
  .li .meta { padding: 10px 14px; background: #edf3f8; } .li .t { font-weight: 600; font-size: 14px; } .li .u { font-size: 12px; color: #666; margin-top: 2px; }

  .fb .stage { background: #f0f2f5; } .fb .post { background: #fff; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.2); overflow: hidden; }
  .fb .meta { padding: 10px 14px; background: #f0f2f5; } .fb .u { font-size: 12px; color: #65676b; text-transform: uppercase; } .fb .t { font-weight: 700; font-size: 16px; margin-top: 2px; } .fb .d { font-size: 14px; color: #65676b; margin-top: 2px; }

  .ig .stage { background: #fff; } .ig .header { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid #efefef; margin-bottom: 14px; }
  .ig .ring { width: 36px; height: 36px; border-radius: 50%; padding: 2px; background: linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf); }
  .ig .ring div { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #fff; background: #003366; }
  .ig .bubble { margin-left: auto; width: 82%; border-radius: 20px; overflow: hidden; background: #efefef; }
  .ig .msg { margin-left: auto; width: fit-content; max-width: 82%; background: #3797f0; color: #fff; padding: 9px 14px; border-radius: 20px; font-size: 14px; margin-bottom: 6px; }
  .ig .meta { padding: 10px 14px; } .ig .t { font-weight: 600; font-size: 14px; } .ig .u { font-size: 12px; color: #737373; margin-top: 2px; }
</style></head><body>
<h1>Share previews for ${domain}</h1>
<p class="lede">Rendered from the page's Open Graph tags (og:title, og:description, og:image). Approximations of each app's light theme.</p>
<div class="grid">

<section class="panel wa"><div class="label"><span class="dot" style="background:#25d366"></span>WhatsApp</div><div class="stage">
  <div class="bubble"><div class="preview">${img}<div class="meta"><div class="t clamp2">${title}</div><div class="d clamp2">${description}</div><div class="u">${bareDomain}</div></div></div>
  <div class="msg">${link}</div><div class="time">10:24 ✓✓</div></div>
</div></section>

<section class="panel ss"><div class="label"><span class="dot" style="background:#ff6719"></span>Substack</div><div class="stage">
  <div class="byline">From a post · 3 min read</div><p>${post}</p>
  <div class="embed">${img}<div class="meta"><div class="t clamp2">${title}</div><div class="d clamp2">${description}</div><div class="u">${bareDomain}</div></div></div>
</div></section>

<section class="panel tg"><div class="label"><span class="dot" style="background:#29a9eb"></span>Telegram</div><div class="stage">
  <div class="bubble"><div class="msg">${link}</div><div class="preview"><div class="s">${site}</div><div class="t clamp2">${title}</div><div class="d clamp3">${description}</div>${img}</div><div class="time">10:24 ✓✓</div></div>
</div></section>

<section class="panel li"><div class="label"><span class="dot" style="background:#0a66c2"></span>LinkedIn</div><div class="stage">
  <div class="post"><div class="author"><div class="avatar">E</div><div><div class="name">${site}</div><div class="sub">Nonprofit · 1h</div></div></div>
  <div class="text">${caption}</div>${img}<div class="meta"><div class="t clamp2">${title}</div><div class="u">${bareDomain}</div></div></div>
</div></section>

<section class="panel fb"><div class="label"><span class="dot" style="background:#1877f2"></span>Facebook</div><div class="stage">
  <div class="post"><div class="author"><div class="avatar">E</div><div><div class="name">${site}</div><div class="sub">Just now · 🌐</div></div></div>
  <div class="text">${caption}</div>${img}<div class="meta"><div class="u">${bareDomain}</div><div class="t clamp2">${title}</div><div class="d clamp1">${description}</div></div></div>
</div></section>

<section class="panel ig"><div class="label"><span class="dot" style="background:#e1306c"></span>Instagram (Direct message)</div><div class="stage">
  <div class="header"><div class="ring"><div></div></div><div><div class="name">evidential</div><div class="sub">Active now</div></div></div>
  <div class="msg">${link}</div>
  <div class="bubble">${img}<div class="meta"><div class="t clamp2">${title}</div><div class="u">${bareDomain}</div></div></div>
  <div class="note">Instagram shows link previews only in Direct messages; feed captions don't render links.</div>
</div></section>

</div></body></html>`;
}

export async function renderShareCards(
  browser: Browser,
  distDir: string,
  outFile: string,
  text: ShareCardText,
): Promise<void> {
  const og = await readOpenGraph(distDir);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(cardsHtml(og, text), { waitUntil: "load" });
  const png = await page.screenshot({ fullPage: true });
  await page.close();
  await sharp(png).webp({ quality: 90 }).toFile(outFile);
}
