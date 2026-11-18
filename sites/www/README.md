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

Production is the `evidential-www` Worker, served only at the `www.evidential.dev` custom domain. Pull requests get
[Previews](https://developers.cloudflare.com/workers/previews/) on a separate Worker, `evidential-www-preview`, at
`https://<name>-evidential-www-preview.the-agency-fund.workers.dev`. `task www:deploy:preview` pushes one from a
workstation, named after the current git branch (or `NAME=…`). Production deploys come only from CI on `main`
(`task www:ci:deploy:production`). Workstations authenticate with `pnpm exec wrangler login`; CI uses each GitHub
environment's `CLOUDFLARE_API_TOKEN` secret.

Keeping Previews off the production Worker means the token that pushes them can't change production. They're public (Cloudflare adds `X-Robots-Tag: noindex` on workers.dev), take their settings
from the `previews` block in `wrangler.jsonc`, and never send email or Slack messages.

`.github/workflows/www.yaml` runs on pull requests to `main` and pushes to `main` that touch this site, and on manual
dispatch. Its jobs call reusable workflows that the docs site's `docs.yaml` shares, each running the site's own tasks:

- **check** (`site-check.yaml`): `task www:ci:check`: type checks, tests, a production build, link check, and Lighthouse
  budgets.
- **preview** (`site-preview.yaml`; same-repo, non-Dependabot pull requests, after **check** passes): only when the
  pull request changes `src/`, `public/`, `worker/*.ts` (not its tests), or `astro.config.mjs`, runs
  `task www:deploy:preview NAME=pr-<number>` and comments the URL. It runs the pull request's code with the `preview`
  environment's token, which can only change the sites' preview Workers.
- **production** (`site-production.yaml`; `main` only): `task www:ci:deploy:production`.

`.github/workflows/preview-cleanup.yaml` deletes a pull request's Previews, for each site, when it's closed or merged,
and sweeps weekly for any it missed.

## Cloudflare resources

Everything lives on the **The Agency Fund** account (`f3fcb6f2a7fba9b85ecb03ce24e0ec48`).

| Resource                                                           | Details                                                                                                                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone `evidential.dev`                                              | Pre-existing. DNS, Email Routing, and Web Analytics (automatic injection) for the domain.                                                                                              |
| Worker `evidential-www`                                            | Static assets from `dist/`, plus the contact-form Worker for `/api/*`. Configured by `wrangler.jsonc`.                                                                                 |
| Custom domain `www.evidential.dev`                                 | Production hostname of `evidential-www`, with its certificate. The Worker's production `workers.dev` URL is disabled.                                                                  |
| Worker `evidential-www-preview`                                    | Holds only Previews, so CI's preview token can be scoped to it. Created by the first `task www:deploy:preview`; see [Requirements](#requirements).                                     |
| Preview URLs                                                       | `https://<name>-evidential-www-preview.the-agency-fund.workers.dev`, one per Preview, served with `X-Robots-Tag: noindex`.                                                             |
| Worker secrets                                                     | `TURNSTILE_SECRET` (production), plus a `SLACK_WEBHOOK_*` secret for each Slack channel in `worker/notifications.config.ts`.                                                           |
| Worker bindings                                                    | `CONTACT_EMAIL` (Send Email, restricted to `support@evidential.dev`); `CONTACT_RATE_LIMIT` (5 requests a minute per IP; namespace `1001` in production, `1002` in Previews); `ASSETS`. |
| Observability                                                      | Workers Logs and Traces, fully sampled. The Worker runs only for form submissions.                                                                                                     |
| Turnstile widget "evidential-www contact form"                     | Managed mode for `evidential.dev` and `www.evidential.dev`. The site key is in `astro.config.mjs`; the secret key is the `TURNSTILE_SECRET` Worker secret.                             |
| Email Routing destination `support@evidential.dev`                 | Verified destination address (Workers can only send to verified destinations). The zone's routing rule for `support@evidential.dev` forwards it to the support inbox.                  |
| Redirect rule `evidential.dev` → `https://www.evidential.dev`      | Sends the apex domain to the site, keeping the path and query string.                                                                                                                  |
| Workers `evidential-docs`, `evidential-docs-preview`               | The docs site and its Previews; see `sites/docs/README.md`.                                                                                                                            |
| R2 bucket `evidential-media`, custom domain `media.evidential.dev` | Large media the sites link to rather than commit, such as the docs' onboarding video under `docs/`. Public, read-only at the custom domain.                                            |
| Account API token `github-actions-evidential-www`                  | Workers **Editor** on `evidential-www` and `evidential-docs` only, with no zone permissions. Used by GitHub Actions for production.                                                    |
| Account API token `github-actions-evidential-www-preview`          | Workers **Editor** on `evidential-www-preview` and `evidential-docs-preview` only. Used by GitHub Actions for Previews, including from pull request code.                              |

On GitHub (`agency-fund/evidential-site`):

| Resource                 | Details                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Environment `preview`    | Used by `site-preview.yaml` (www and docs) and `preview-cleanup.yaml`; any branch.                                                 |
| Environment `production` | Used by `site-production.yaml` (www and docs); deployments allowed only from `main`.                                               |
| `CLOUDFLARE_ACCOUNT_ID`  | Variable in both environments.                                                                                                     |
| `CLOUDFLARE_API_TOKEN`   | Secret in each environment: `github-actions-evidential-www-preview` in `preview`, `github-actions-evidential-www` in `production`. |

Pull request code can read the `preview` token, which is why it's scoped to the Preview Worker alone. Never put the
production token in `preview`.

## Requirements

These aren't visible in the configuration files, so reproducing the setup has to account for them:

- **Custom domain**: attaching `www.evidential.dev` needs _Zone › Workers Routes: Write_ on evidential.dev. CI
  deliberately lacks it, since it would let CI attach any Worker to any hostname on the zone, so the first production
  deploy came from a workstation (`task www:launch`). CI then uploads and deploys versions
  (`wrangler versions upload`, then `wrangler versions deploy`), which need only Workers Editor and never touch the
  domain. Changes to `routes` or `workers_dev` in `wrangler.jsonc` take a `wrangler deploy` from a workstation. The
  custom domain owns the zone's `www` DNS record.
- **Production secrets** live on a Worker version, and `wrangler deploy` refuses to run until every secret in
  `secrets.required` is set. The first deploy therefore uploads `TURNSTILE_SECRET` with it (`task www:launch`
  prompts for it); later versions inherit it.
- **Workers must exist before CI deploys to them**, since the CI tokens can't create Workers. The preview Worker is
  created by the first `wrangler preview` pushed to it, which takes `workers_dev: false` and `preview_urls: true` from
  `wrangler.jsonc` and never gets a production version.
- **Tokens** are created in the Cloudflare dashboard, since creating one by API needs a token that can create tokens.
  Each gets the Workers role **Editor** scoped to individual Workers, and nothing else. Custom domains don't yet
  support per-Worker roles, so if a production deploy fails on authorization, the fallback is **Editor** for all of
  Workers, still with no zone permissions. `task setup:github` (`scripts/setup-github.sh`) creates the GitHub
  environments, limits `production` to `main`, and stores each token after verifying it with Cloudflare.
- **Apex redirect**: a Redirect Rule on the zone sends `evidential.dev` to
  `concat("https://www.evidential.dev", http.request.uri.path)` (301, query string preserved). It only applies while
  the apex DNS record is proxied.
- **Email**: the Worker can only send to Email Routing destination addresses verified on the account; see
  [Contact form notifications](#contact-form-notifications).
