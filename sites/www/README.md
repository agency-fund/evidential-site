# www.evidential.dev

The marketing site: a static [Astro](https://astro.build) site served by Cloudflare Workers Static Assets. A small
Worker (`worker/`) handles the contact form at `/api/contact`; every other request is served straight from the built
files.

## Editing content

Most copy lives in YAML under `src/content/`. Entries render in file order, and each file's schema is in
`src/content.config.ts`. A build fails with a clear error if a field is missing or misspelled.

| To change…                              | Edit                                                |
| --------------------------------------- | --------------------------------------------------- |
| Partner logos (marquee, quotes, cards)  | `src/content/partners.yaml`, `src/assets/partners/` |
| Headline stats (experiments, orgs)      | `src/content/stats.yaml`                            |
| Testimonials                            | `src/content/testimonials.yaml`                     |
| Partner experiment results              | `src/content/partner-tests.yaml`                    |
| "Built for how non-profits work" points | `src/content/why.yaml`                              |
| Comparison table                        | `src/content/comparison.yaml`                       |
| Five steps                              | `src/content/steps.yaml`                            |
| Feature picker and screenshot crops     | `src/content/features.yaml`                         |
| "Where are you starting from?" options  | `src/content/readiness.yaml`                        |
| Contact form choices and messages       | `src/contact.ts` (shared with the Worker)           |
| Where form submissions are delivered    | `worker/notifications.config.ts`                    |
| Nav, footer links, URLs, page metadata  | `src/site.ts`, `src/components/Footer.astro`        |

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

| Command                         | Effect                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task www:deploy:preview`       | Builds and pushes a [Preview](https://developers.cloudflare.com/workers/previews/) named after the current git branch (or `NAME=…`) on the `evidential-www-preview` Worker and prints its URL, `https://<name>-evidential-www-preview.the-agency-fund.workers.dev`. Doesn't affect production. |
| `task www:launch`               | The one-time first production deploy; see [First Deploy](#first-deploy).                                                                                                                                                                                                                       |
| `task www:ci:deploy:production` | CI only: builds and deploys a new production version from `main`.                                                                                                                                                                                                                              |

Local runs authenticate with `pnpm exec wrangler login`; CI uses each GitHub environment's `CLOUDFLARE_API_TOKEN`
secret.

Previews live on their own Worker, `evidential-www-preview`, not on the production Worker, so the token that pushes them
can't change production. They're public (Cloudflare adds `X-Robots-Tag: noindex` on workers.dev), take their settings
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
| Worker `evidential-www-preview`                                    | Holds only Previews, so CI's preview token can be scoped to it. Created by the first `task www:deploy:preview`; see [Preview Worker](#preview-worker).                                 |
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

# Playbook

## First Deploy

Switches `www.evidential.dev` from the old origin to this site. Run it from a workstation, not CI: attaching the custom
domain needs _Zone › Workers Routes: Write_ on evidential.dev, which the CI token deliberately doesn't have.

1. Log in: `pnpm exec wrangler login`, as a member of The Agency Fund account.
2. Copy the secret key of the "evidential-www contact form" widget from the Turnstile dashboard.
3. Run `task www:launch`. Type `launch` to confirm, then paste the secret key at the hidden prompt. It builds the
   production site and runs `wrangler deploy` with `TURNSTILE_SECRET` uploaded alongside: production secrets live on a
   Worker version, and there is none before this deploy. The deploy attaches the `www.evidential.dev` custom domain.
4. Check `https://www.evidential.dev`: the page loads, and a contact-form submission arrives at
   `support@evidential.dev`. If it doesn't, look for `contact.notification_failed` in the Worker's logs.
5. Add the apex redirect: in the zone's **Rules › Redirect Rules**, create a rule matching hostname
   `evidential.dev` that redirects (301) to `concat("https://www.evidential.dev", http.request.uri.path)`, preserving
   the query string. Keep the apex DNS record proxied so the rule applies.

Later deploys keep the secret. They come from CI ([Production Deploys](#production-deploys)), and need only Editor
access because they leave the custom domain unchanged.

## GitHub Actions Credentials

1. Create two Cloudflare tokens in the dashboard: **The Agency Fund › Manage account › Account API tokens › Create
   Token**. Grant each the Workers role **Editor**, scoped to **individual Workers**, and nothing else. (Creating a
   token can't be scripted without an existing token that can create tokens.)
   - `github-actions-evidential-www`: scoped to `evidential-www` and `evidential-docs`.
   - `github-actions-evidential-www-preview`: scoped to `evidential-www-preview` and `evidential-docs-preview`. That Worker must exist first; see
     [Preview Worker](#preview-worker).
2. Run `task setup:github` (`scripts/setup-github.sh`) and paste each token at its hidden prompt (Enter keeps the
   current one). It creates the GitHub environments, limits `production` to `main`, sets the variable in both, and
   verifies each token with Cloudflare before storing it in its environment. It's safe to re-run.

Cloudflare notes that custom domains don't yet support per-Worker roles. If a CI production deploy fails on
authorization, widen the role to **Editor** for the whole Workers product, still with no zone permissions. Never add
_Zone › Workers Routes: Write_: it would let CI attach any Worker to any hostname on evidential.dev.

## Preview Worker

`evidential-www-preview` is created by the first Preview pushed to it, which needs an account that can create Workers.
Do that once from a workstation, before creating its token:

```sh
pnpm exec wrangler login
task www:deploy:preview NAME=bootstrap
pnpm exec wrangler preview delete --worker-name evidential-www-preview --name bootstrap
```

It takes `workers_dev: false` and `preview_urls: true` from `wrangler.jsonc`, and never gets a production version.

## PR Lifecycle & Automatic Preview Environments

1. Push a branch to `agency-fund/evidential-site` and open a pull request against `main`.
2. The **check** job runs type checks, tests, the link check, and Lighthouse budgets.
3. If checks pass, the **preview** job pushes a Preview named `pr-<number>` and comments its URL on the pull request. Each later push to the branch updates the
   same Preview and comment. Pull requests from forks or Dependabot, and those that change only tooling, tests, docs,
   or dependencies, get checks but no Preview.
4. Merging to `main` runs **check** and then **production**, which deploys the site.
5. Closing or merging the pull request deletes its Preview (`.github/workflows/preview-cleanup.yaml`, which runs
   `.github/scripts/preview_cleanup.py`) and updates
   the comment to say so. If a deploy is still running at that moment, the cleanup waits for it to finish, and a deploy
   that starts after the close sees the pull request is closed and skips, so neither can leave a Preview behind. A weekly run of the same workflow, which can also be started manually, deletes any `pr-<number>` Preview
   whose pull request is closed. Previews with other names, such as ones pushed from a workstation, are left alone;
   delete those with `pnpm exec wrangler preview delete --worker-name evidential-www-preview --name <name>`.

A brand-new Preview can return Cloudflare's plain-text 404 for up to a minute while its hostname propagates.

## Previews From a Workstation

`task www:deploy:preview` builds the site as a Preview and pushes it under the current branch name, or under
`NAME=<name>`. Use it to share work before opening a pull request.

## Production Deploys

Every merge to `main` that touches the site deploys automatically. To redeploy without a change, run the **www**
workflow manually from the Actions tab on `main`. Avoid deploying production from a workstation; that's what the
`ci:` prefix on `www:ci:deploy:production` signals.

## Rolling Back

`pnpm exec wrangler rollback` returns production to the previous version immediately, and needs only Editor access.
Then revert the offending change on `main`, so the next deploy doesn't reintroduce it.

## Rotating Secrets

- **Turnstile secret:** rotate it in the Turnstile dashboard, then run `pnpm exec wrangler secret put
TURNSTILE_SECRET` and paste the new value. This deploys a new version with the secret immediately.
- **Slack webhook:** regenerate it in Slack, then run `pnpm exec wrangler secret put SLACK_WEBHOOK_<NAME>`.
- **GitHub Actions tokens:** create a new token as in [GitHub Actions Credentials](#github-actions-credentials), run
  `task setup:github` and paste it at its environment's prompt, then delete the old token in the Cloudflare dashboard.
