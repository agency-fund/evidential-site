/**
 * Every URL docs.evidential.dev has served, mapped to where that content lives now. When this site takes over the
 * hostname from the MkDocs site, links, bookmarks, and search results must keep working.
 *
 * - PAGE_REDIRECTS feeds Astro's `redirects` (astro.config.ts), so they work in dev and preview and the
 *   nimbus/internal-link and nimbus/redirected-link lint rules know them. A static build writes them as
 *   meta-refresh pages.
 * - On Cloudflare, the build also writes every entry here to dist/_redirects (see `cloudflareRedirects` in
 *   astro.config.ts), so the deployed site answers with real 301s, which search engines treat as permanent moves.
 *   FILE_REDIRECTS covers URLs that aren't pages, which only _redirects can redirect.
 *
 * Each entry points straight at the final URL: when a page moves again, update its existing entries rather than
 * adding a new hop, and add its current URL as a new entry. Sources are the MkDocs site's sitemap (as of November
 * 2026), its own redirects (from its mkdocs.yaml), and URLs this site used before the current layout.
 */
export const PAGE_REDIRECTS: Record<string, string> = {
  // MkDocs pages.
  "/welcome/getting-started/": "/quickstart/",
  "/integration/integration/": "/guides/integrate-with-the-api/",
  "/integration/overview/": "/concepts/how-evidential-works/",
  "/analytics/data_analysis/": "/concepts/statistical-methods/",
  "/analytics/data_storage/": "/concepts/data-storage-and-privacy/",
  "/blog/": "/news/",
  "/blog/archive/2025/": "/news/",
  "/blog/2025/08/20/multi-armed--contextual-bandits-experiments/": "/news/multi-armed-and-contextual-bandits/",
  "/blog/2025/10/27/experiment-results-history/": "/news/experiment-results-history/",
  "/contributing-docs/": "/develop/guides/contribute-to-the-docs/",
  "/development/getting-started-dev/": "/develop/setup/",
  "/development/reading-list/": "/develop/reading-list/",
  "/development/contributing-dev/": "/develop/guides/contribute-code/",
  "/development/airplane-mode/": "/develop/setup/",
  "/development/testing/": "/develop/guides/run-tests/",
  "/development/updating-testing-dwh/": "/develop/guides/update-the-testing-warehouse/",
  "/development/migration/": "/develop/guides/manage-database-migrations/",
  "/development/faq/": "/develop/guides/troubleshooting/",
  "/development/workers/": "/develop/concepts/background-workers/",
  "/development/sqlalchemy/": "/develop/concepts/sqlalchemy/",
  "/development/configuring-oidc/": "/operate/guides/configure-oidc/",
  "/development/secrets/": "/operate/guides/encrypt-secrets/",
  "/development/error-reporting/": "/operate/guides/report-errors-to-sentry/",

  // The MkDocs site's own redirects (mkdocs.yaml, redirect_maps).
  "/welcome/": "/",
  "/development/enabling-oidc/": "/operate/guides/configure-oidc/",
  "/development/task-queues/": "/develop/concepts/background-workers/",

  // URLs this site used before the current layout.
  "/blog/experiment-results-history/": "/news/experiment-results-history/",
  "/blog/multi-armed-and-contextual-bandits/": "/news/multi-armed-and-contextual-bandits/",
  "/development/contributing-docs/": "/develop/guides/contribute-to-the-docs/",

  // Pages that were removed, sent to the page that replaced them.
  // Airplane mode was removed; development now signs in through the backend's development identity provider.
  "/develop/guides/develop-offline/": "/develop/setup/",

  // Section folders that have no page of their own.
  "/development/": "/develop/",
  "/develop/guides/": "/develop/",
  "/develop/concepts/": "/develop/",
  "/operate/guides/": "/operate/",
};

/** URLs that aren't pages: written only to dist/_redirects. */
export const FILE_REDIRECTS: Record<string, string> = {
  "/sitemap.xml": "/sitemap-index.xml",
  // The onboarding video moved to R2; the MkDocs pages embedded it from here.
  "/media/video/evidential_demo_20250709.mp4": "https://media.evidential.dev/docs/evidential_demo_20250709.mp4",
};
