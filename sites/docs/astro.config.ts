import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";
import cloudflareRedirects from "./src/integrations/cloudflare-redirects";
import devSearchIndex from "./src/integrations/dev-search-index";
import { PAGE_REDIRECTS } from "./src/redirects";

const nimbusConfig = defineNimbusConfig({
  // Canonical origin (no trailing slash): canonical URLs, absolute OG image URLs, robots.txt, sitemap, and /llms.txt.
  site: "https://docs.evidential.dev",
  // The window title, alone on the home page and after the page title elsewhere ("Workers | Evidential").
  title: "Evidential",
  description: "Documentation for Evidential, a free, open-source experiment engine for nonprofits.",
  locale: "en",
  // Shown as the GitHub link in the header.
  github: "https://github.com/agency-fund/evidential-site",
  socialImageAlt: "Evidential documentation preview",
  // The reference at /api, generated from the live API's spec as adapted by scripts/polish-openapi.mjs (see
  // `task docs:openapi`).
  // routes.operations pins URLs, keyed by operationId, for operations whose method and path don't derive a unique
  // resource/action route. (Comments inside `api` stop `nimbus-docs check` from reading it, so they go here.)
  api: [
    {
      collection: "api",
      spec: "./src/api/openapi.json",
      // publishSpec: false,
      routes: {
        convention: "resource-action-v2",
        stripPathPrefixes: ["/v1"],
        operations: {
          get_experiment_assignments: "assignments/list",
          get_experiment_assignments_as_csv: "assignments/export-csv",
          get_assignment: "assignments/retrieve",
          get_assignment_filtered: "assignments/assign-with-filters",
          get_assignment_cmab: "assignments/assign-cmab",
          update_bandit_arm_with_participant_outcome: "outcomes/record",
        },
      },
    },
  ],
  // Users first and open; developers and operators below, collapsed. The folders under src/content/docs/ are the
  // groups (guides/ and concepts/ are Diátaxis types, within each audience); a page's `sidebar.order` sets its place
  // in its folder, and a folder's index.mdx is its landing page. The group holding the current page always opens.
  sidebar: {
    defaultCollapsed: true,
    // Each section's index.mdx is its first entry, labelled Overview.
    indexDisplay: "overview-leaf",
    overviewLabel: true,
    items: [
      "index",
      "quickstart",
      { label: "Guides", collapsed: false, autogenerate: { directory: "guides" } },
      { label: "Concepts", collapsed: false, autogenerate: { directory: "concepts" } },
      { label: "API reference", link: "/api/" },
      { label: "What's New", autogenerate: { directory: "news" } },
      { label: "Develop Evidential", autogenerate: { directory: "develop" } },
      { label: "Operate Evidential", autogenerate: { directory: "operate" } },
      "contact",
      // Terms of Service is left out until legal/terms.mdx has the terms; it's a copy of the Privacy Policy.
      { label: "Privacy Policy", link: "/legal/privacy/" },
    ],
  },
});

export default defineConfig({
  // nimbus:adapter
  output: "static",
  // Every URL the MkDocs site served, and this site's earlier URLs; see src/redirects.ts.
  redirects: PAGE_REDIRECTS,
  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
  },
  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    // Serves the last build's search index to `astro dev`; see the file for why.
    devSearchIndex(),
    // Writes dist/_redirects so Cloudflare answers old URLs with 301s; see the file.
    cloudflareRedirects(),
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design — your repo, your taste. The
      // two below are the load-bearing pair: frontmatter has to validate
      // against the content schema for the page to render properly, and
      // broken internal links are 404s for your readers. Add the others
      // (heading hierarchy, code-block language, style, etc.) when you're
      // ready to enforce them — see `nimbus-docs lint --help`.
      rules: {
        "nimbus/frontmatter-shape": "error",
        "nimbus/internal-link": "error",
        // Links that still go through one of the redirects above.
        "nimbus/redirected-link": "error",
      },
      markdown: {
        // Wrap wide tables so they scroll instead of overflowing the page
        // (styled by `.nb-table-scroll` in src/styles/prose.css).
        hastPlugins: [tableScroll()],
        // `## Install {#install}` gives a heading a fixed id. A heading that
        // ends in other `{…}` text, such as `{account_id}` in a .md file, is
        // read as attributes too; remove this to keep it as text.
        features: { headingAttributes: true },
      },
    }),
  ],
});
