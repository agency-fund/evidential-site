// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";

const PRODUCTION_TURNSTILE_SITE_KEY = "0x4AAAAAAGF2EIsVlurhPK2l";
const TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

export default defineConfig({
  site: "https://www.evidential.dev",
  trailingSlash: "ignore",
  // Zero-specificity scoping keeps the cascade identical to the original single-stylesheet design.
  scopedStyleStrategy: "where",
  integrations: [sitemap()],
  build: {
    // One page, so inlining all CSS removes a render-blocking round trip without losing useful caching.
    inlineStylesheets: "always",
  },
  vite: {
    build: {
      // Emit even small assets (textures, icons) as hashed files: cacheable and deduplicated, never inlined as data: URIs.
      assetsInlineLimit: 0,
    },
  },
  env: {
    schema: {
      // "production" only for www.evidential.dev; "preview" for PR deployments; "development" locally.
      DEPLOY_ENV: envField.enum({
        context: "client",
        access: "public",
        values: ["development", "preview", "production"],
        default: "development",
      }),
      // Site keys are public. Production uses the "evidential-www contact form" widget (www.evidential.dev and
      // evidential.dev); every other build uses Cloudflare's always-passing test key, which previews' Worker accepts.
      TURNSTILE_SITE_KEY: envField.string({
        context: "client",
        access: "public",
        default: process.env.DEPLOY_ENV === "production" ? PRODUCTION_TURNSTILE_SITE_KEY : TEST_TURNSTILE_SITE_KEY,
      }),
    },
  },
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700, 800],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["Helvetica Neue", "Arial", "sans-serif"],
    },
    {
      // Google's latin subset of Inter omits "→", so it would fall back to Arial. This loads just that glyph.
      name: "Inter",
      cssVariable: "--font-inter-arrow",
      provider: fontProviders.google(),
      options: { experimental: { glyphs: ["→"] } },
      weights: [500, 600, 700],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
    },
    {
      name: "IBM Plex Mono",
      cssVariable: "--font-plex-mono",
      provider: fontProviders.google(),
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },
    {
      name: "Jost",
      cssVariable: "--font-jost",
      provider: fontProviders.google(),
      weights: [500],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
  ],
});
