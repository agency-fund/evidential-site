# www.evidential.dev

The marketing site: a static [Astro](https://astro.build) site served by Cloudflare Workers Static Assets. A small
Worker (`worker/`) handles the contact form at `/api/contact`; every other request is served straight from the built
files.

## Editing content

Most copy lives in YAML under `src/content/`. Entries render in file order, and each file's schema is in
`src/content.config.ts`. A build fails with a clear error if a field is missing or misspelled.

| To change…                             | Edit                                                |
| -------------------------------------- | --------------------------------------------------- |
| Partner logos (marquee, quotes, cards) | `src/content/partners.yaml`, `src/assets/partners/` |
| Headline stats (experiments, orgs)     | `src/content/stats.yaml`                            |
| Testimonials                           | `src/content/testimonials.yaml`                     |
| Partner experiment results             | `src/content/partner-tests.yaml`                    |
| "Built for how nonprofits work" points | `src/content/why.yaml`                              |
| Comparison table                       | `src/content/comparison.yaml`                       |
| Five steps                             | `src/content/steps.yaml`                            |
| Feature picker and screenshot crops    | `src/content/features.yaml`                         |
| "Where are you starting from?" options | `src/content/readiness.yaml`                        |
| Contact form choices and messages      | `src/contact.ts` (shared with the Worker)           |
| Where form submissions are delivered   | `worker/notifications.config.ts`                    |
| Nav, footer links, URLs, page metadata | `src/site.ts`, `src/components/Footer.astro`        |

Each section of the page is one component in `src/components/`, with its markup, scoped styles, and behavior in the
same file. Design tokens (colors, type scale, spacing) are in `src/styles/tokens.css`. Images in `src/assets/` are
resized and converted to WebP at build time, so commit originals rather than pre-optimized copies.

## Local development

| Command               | What it does                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `task www:start`      | Astro dev server with hot reload. The contact form doesn't work here.                                                 |
| `task www:preview`    | Production build served by `wrangler dev`, including the contact Worker.                                              |
| `task www:check`      | Generates Worker types, then `astro check`, Worker type check, Prettier, and Worker tests.                            |
| `task www:types`      | Regenerates Worker types (`worker/worker-configuration.d.ts`, gitignored) from `wrangler.jsonc`.                      |
| `task www:linkcheck`  | Checks internal links and anchors in `dist/`.                                                                         |
| `task www:lighthouse` | Lighthouse CI with the score budgets in `lighthouserc.json`, using Playwright's Chromium unless `CHROME_PATH` is set. |

`task www:preview` copies `.dev.vars.example` to `.dev.vars`. That file holds Cloudflare's Turnstile test secret, so
the form works locally, and Wrangler writes "sent" emails to `.wrangler/tmp/email/` instead of delivering them.

## Contact form notifications

Submissions are delivered to every channel listed in `worker/notifications.config.ts`, in parallel. A channel that
fails is logged (by channel name) and doesn't stop the others; the visitor sees an error only if every channel fails.
Preview deployments never send notifications.

- **Email:** add `{ kind: "email", name, to }`. The address must also be in `allowed_destination_addresses` of
  the `CONTACT_EMAIL` binding in `wrangler.jsonc`, and be a verified Email Routing _destination address_ on the
  account (a routing rule for the address isn't enough). Today the form sends to `support@evidential.dev`.
- **Slack:** create an [incoming webhook](https://api.slack.com/messaging/webhooks) for the channel. Then:
  1. Add its secret name, e.g. `SLACK_WEBHOOK_WEBSITE_LEADS`, to `secrets.required` in `wrangler.jsonc`, and run
     `task www:types`.
  2. Add `{ kind: "slack", name: "#website-leads", webhookSecret: "SLACK_WEBHOOK_WEBSITE_LEADS" }` to the config.
     It won't type-check until step 1 is done.
  3. Store the URL with `pnpm exec wrangler secret put SLACK_WEBHOOK_WEBSITE_LEADS`. `wrangler deploy` refuses to
     run until every required secret is set.

  Webhook URLs are credentials: keep them in secrets, never in the config file.

The Worker logs one JSON event per submission to Workers Logs: `contact.delivered` lists the channels that succeeded
and failed, and each failure also logs `contact.notification_failed` with the error. No personal data or secret values
are logged.

## Sharing the current state with the team

`task www:walkthrough` builds the site as production, serves it with `wrangler dev`, and writes these files to
`sites/www/walkthrough/` (gitignored):

| File                  | Contents                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `walkthrough.mp4`     | 2-minute, 1280×1024 H.264 video demonstrating every interactive feature, with captions                   |
| `share-previews.webp` | The page's link preview as it appears in WhatsApp, Substack, Telegram, LinkedIn, Facebook, and Instagram |
| `lighthouse.webp`     | Lighthouse scores and performance report (median of three mobile runs)                                   |

It needs `ffmpeg` with libx264 (`brew install ffmpeg` or `apt install ffmpeg`). Pass `ONLY=video`, `ONLY=cards`, or
`ONLY=lighthouse` (comma-separated) to regenerate just some of them. Analytics requests are blocked, and the contact
form uses Turnstile test keys and simulated email, so runs never count as visits or send mail.

The script lives in `scripts/walkthrough/`; the docs site's walkthrough (`sites/docs/walkthrough/`) reuses its recorder
and share-card modules, so changes there affect both. When you add or change an interactive feature, update the timeline in
`video.ts`: each section has a target start time, and the script warns if a section runs behind.

## Environments

`DEPLOY_ENV` controls build-time behavior (see `astro.config.mjs`):

| `DEPLOY_ENV`            | Indexing                       | Analytics                                                                         | Contact form                                     |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `development` (default) | `noindex`, disallow-all robots | Off                                                                               | Turnstile test keys                              |
| `preview`               | `noindex`, disallow-all robots | Off                                                                               | Turnstile test keys; no notifications sent       |
| `production`            | Indexed, sitemap               | GTM (consent-gated); Cloudflare Web Analytics, injected by Cloudflare at the edge | Real Turnstile; email (and Slack, if configured) |

## Deployment

How both sites are checked, previewed, and deployed, and the Cloudflare and GitHub resources they share, are in
[sites/README.md](../README.md). What's specific to www:

- **Production**: Worker `evidential-www`, served only at the `www.evidential.dev` custom domain. The Worker runs only
  for `/api/*` (the contact form); every other request is served straight from `dist/`.
- **Previews**: Worker `evidential-www-preview`. Same-repo pull requests get one when they change `src/`, `public/`,
  `worker/*.ts` (not its tests), or `astro.config.mjs`. Previews build with `DEPLOY_ENV=preview` and never send email
  or Slack messages.

| Resource                                                      | Details                                                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom domain `www.evidential.dev`                            | Production hostname of `evidential-www`, with its certificate. Owns the zone's `www` DNS record. The Worker's production `workers.dev` URL is disabled.                                |
| Worker secrets                                                | `TURNSTILE_SECRET` (production), plus a `SLACK_WEBHOOK_*` secret for each Slack channel in `worker/notifications.config.ts`.                                                           |
| Worker bindings                                               | `CONTACT_EMAIL` (Send Email, restricted to `support@evidential.dev`); `CONTACT_RATE_LIMIT` (5 requests a minute per IP; namespace `1001` in production, `1002` in Previews); `ASSETS`. |
| Observability                                                 | Workers Logs and Traces, fully sampled. The Worker runs only for form submissions.                                                                                                     |
| Turnstile widget "evidential-www contact form"                | Managed mode for `evidential.dev` and `www.evidential.dev`. The site key is in `astro.config.mjs`; the secret key is the `TURNSTILE_SECRET` Worker secret.                             |
| Email Routing destination `support@evidential.dev`            | Verified destination address (Workers can only send to verified destinations). The zone's routing rule for `support@evidential.dev` forwards it to the support inbox.                  |
| Redirect rule `evidential.dev` → `https://www.evidential.dev` | Sends the apex domain to the site with a 301, keeping the path and query string.                                                                                                       |

Requirements beyond the shared ones:

- **Production secrets** live on a Worker version, and deploys refuse to run until every secret in `secrets.required`
  is set. The first deploy therefore uploaded `TURNSTILE_SECRET` with it (`task www:launch` prompts for it); later
  versions inherit it.
- **Apex redirect**: the Redirect Rule matches `evidential.dev` and redirects (301, query string preserved) to
  `concat("https://www.evidential.dev", http.request.uri.path)`. It only applies while the apex DNS record is proxied;
  the record points at the placeholder `192.0.2.1`.
- **Email**: the Worker can only send to Email Routing destination addresses verified on the account; see
  [Contact form notifications](#contact-form-notifications).
