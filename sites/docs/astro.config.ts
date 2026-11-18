import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";
import devSearchIndex from "./src/integrations/dev-search-index";

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
  // Mirrors the MkDocs navigation. Pages keep their MkDocs URLs, so the groups are listed here rather than mirrored
  // by folders. A new page appears only once it is added below.
  sidebar: {
    items: [
      { label: "Welcome", items: ["index", "welcome/getting-started"] },
      {
        label: "For developers",
        items: [
          "development/getting-started-dev",
          { label: "Contributing", items: ["development/contributing-dev", "contributing-docs"] },
          {
            label: "How-to guides",
            items: [
              "development/airplane-mode",
              "development/configuring-oidc",
              "development/error-reporting",
              "development/testing",
              "development/updating-testing-dwh",
              "development/sqlalchemy",
              "development/migration",
            ],
          },
          {
            label: "Explainers",
            items: ["development/secrets", "development/workers", "development/reading-list", "development/faq"],
          },
        ],
      },
      {
        label: "For users",
        items: [
          {
            label: "Integrating",
            items: ["integration/overview", "integration/integration", { label: "API reference", link: "/api/" }],
          },
          { label: "Analyzing", items: ["analytics/data_analysis", "analytics/data_storage"] },
          {
            label: "What's New",
            items: ["blog", "blog/experiment-results-history", "blog/multi-armed-and-contextual-bandits"],
          },
        ],
      },
      {
        label: "Contact us",
        items: [
          "contact",
          // Terms of Service is left out until legal/terms.mdx has the terms; it's a copy of the Privacy Policy.
          { label: "Legal", items: [{ label: "Privacy Policy", link: "/legal/privacy/" }] },
        ],
      },
    ],
  },
});

export default defineConfig({
  // nimbus:adapter
  output: "static",
  // URLs from the MkDocs site: its own redirects, and blog posts that MkDocs served under their dates.
  redirects: {
    "/welcome/": "/",
    "/development/enabling-oidc/": "/development/configuring-oidc/",
    "/development/task-queues/": "/development/workers/",
    "/blog/2025/08/20/multi-armed--contextual-bandits-experiments/": "/blog/multi-armed-and-contextual-bandits/",
    "/blog/2025/10/27/experiment-results-history/": "/blog/experiment-results-history/",
  },
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
