/**
 * The site's social cards, 1200 × 630 PNGs rendered at build time. `og/[...slug].ts` draws one per page and
 * `og.png.ts` the site's own, with its description as the title.
 *
 * They follow www.evidential.dev's card (sites/www/public/og.png): the wordmark on a warm, faintly gridded page, a
 * bold navy headline, and a navy band along the foot, with the docs' gold rule under the title and the page's section
 * as a gold eyebrow.
 *
 * `@cloudflare/nimbus-docs/og` loads the fonts, fits text to its lines by measuring it, and renders the PNG. The fonts
 * are Inter's Latin WOFF files from @fontsource/inter, read at build time only; Satori can't read WOFF2. To use
 * another script, such as Chinese or Japanese, add a font that covers it to `fonts`.
 *
 * The leading underscore keeps Astro from routing this file.
 */
import {
  createCardRenderer,
  type CardNode,
  type CardTypography,
} from "@cloudflare/nimbus-docs/og";
import { root } from "astro:config/server";

import { WORDMARK_COLORS, wordmark } from "@/components/wordmark";

// www's palette (sites/www/src/styles/tokens.css), in hex for Satori.
const PAGE = "#fdfcf8";
const GRID = "#f0eee6";
const NAVY = "#003366";
const GOLD = "#d49e00";
const GOLD_INK = "#8a6700";

const WIDTH = 1200;
const HEIGHT = 630;
const LEFT = 96;
const COLUMN = WIDTH - LEFT * 2;
const BAND = 16;

const TITLE: CardTypography = {
  fontFamily: "Inter",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1.06,
  color: NAVY,
};
const EYEBROW: CardTypography = {
  fontFamily: "Inter",
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: 1.2,
  color: GOLD_INK,
};

const font = (weight: number) =>
  new URL(
    `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
    root,
  );
const renderer = await createCardRenderer({
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    { name: "Inter", source: font(400), weight: 400 },
    { name: "Inter", source: font(700), weight: 700 },
  ],
  emoji: "strip",
});

type Style = Record<string, string | number>;
const el = (
  type: string,
  style: Style,
  children?: CardNode | (CardNode | undefined)[] | string,
): CardNode => ({
  type,
  props: { style, children },
});

const Wordmark = (height: number): CardNode => ({
  type: "svg",
  props: {
    width: Math.round((height * wordmark.width) / wordmark.height),
    height,
    viewBox: wordmark.viewBox,
    children: wordmark.paths.map(({ part, d }) => ({
      type: "path",
      props: { d, fill: WORDMARK_COLORS[part] },
    })),
  },
});

async function card({
  section,
  title,
  sizes,
}: {
  section?: string;
  title: string;
  sizes: number[];
}): Promise<CardNode> {
  const heading = await renderer.fit(title, {
    width: COLUMN,
    sizes,
    lines: 3,
    style: TITLE,
  });
  const eyebrow = await renderer.fit(
    (section ?? "Documentation").toUpperCase(),
    {
      width: COLUMN,
      sizes: [24, 22],
      lines: 1,
      style: EYEBROW,
    },
  );
  return el(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      position: "relative",
      backgroundColor: PAGE,
      backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
      backgroundSize: "48px 48px",
    },
    [
      el(
        "div",
        { position: "absolute", left: LEFT - 8, top: 80, display: "flex" },
        Wordmark(60),
      ),
      // Hung from the top rather than the foot: X crops the card to 2:1 and covers its foot with the link's domain.
      el(
        "div",
        {
          position: "absolute",
          left: LEFT,
          top: 212,
          width: COLUMN,
          display: "flex",
          flexDirection: "column",
        },
        [
          el("div", { display: "flex", marginBottom: 20 }, eyebrow.node),
          heading.node,
          el("div", {
            width: 88,
            height: 8,
            marginTop: 30,
            borderRadius: 999,
            backgroundColor: GOLD,
          }),
        ],
      ),
      el("div", {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: BAND,
        backgroundColor: NAVY,
      }),
    ],
  );
}

/** A page's card. */
export const renderPageCard = async (input: {
  section?: string;
  title: string;
}) => renderer.png(await card({ ...input, sizes: [72, 64, 56, 50, 44] }));

/** The site's card: its description, or its title when it has none. */
export const renderSiteCard = async (input: { title: string }) =>
  renderer.png(await card({ ...input, sizes: [64, 56, 50, 44] }));
