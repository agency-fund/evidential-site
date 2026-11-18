# Shared site infrastructure

What www.evidential.dev (`sites/www`) and docs.evidential.dev (`sites/docs`) have in common: how they're built,
checked, previewed, and deployed, and the Cloudflare and GitHub resources behind them. Each site's README covers what's
specific to it.

## Conventions

Each site is an Astro project served by Cloudflare Workers Static Assets from its built `dist/`, configured by its
`wrangler.jsonc`. Its `Taskfile.yml` defines the same tasks, run from the repository root with the site's prefix
(`task www:…`, `task docs:…`):

| Task                   | What it does                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `start`                | Dev server with hot reload: www at http://localhost:4321, docs at http://localhost:4322.      |
| `check`                | The site's type checks, tests, and lints.                                                     |
| `deploy:preview`       | Builds and pushes a Preview named after the git branch, or `NAME=…`, and prints its URL.      |
| `walkthrough`          | Records a tour video and share-preview cards for the team. The recorder lives in `sites/www`. |
| `ci:check`             | CI only: a build plus every check.                                                            |
| `ci:deploy:production` | CI only: builds, then uploads and deploys a new production version.                           |
| `launch`               | The one-time first production deploy, from a workstation; see [Requirements](#requirements).  |

## CI

Each site has a workflow, `.github/workflows/<site>.yaml`, that runs on pull requests to `main` and pushes to `main`
that touch the site, and on manual dispatch. Its jobs:

- **check**: the reusable workflow `site-check.yaml` runs `task <site>:ci:check` and uploads any reports, such as
  www's Lighthouse results.
- **preview-wanted** and **preview** (same-repo, non-Dependabot pull requests, after **check** passes): only when the
  pull request changes files readers see, as listed in the workflow, pushes a Preview named `pr-<number>` and comments
  its URL on the pull request. It runs the pull request's code with the `preview` environment's token.
- **production** (`main` only): `task <site>:ci:deploy:production` with the `production` environment's token.

The preview and production jobs declare their environment themselves and pass its token, as an input, to the
composite actions in `.github/actions/` (`deploy-preview`, `deploy-production`) that hold their steps. Reusable
workflows can't read environment secrets unless the caller inherits every secret, so only the checks, which need
none, use one.

A newer push to a pull request cancels the older run, even mid-deploy. That's safe: wrangler switches a Preview over in
one final call, so an interrupted upload leaves the previous version serving.

`.github/workflows/preview-cleanup.yaml` deletes a pull request's Previews, for each site, when it's closed or merged,
and sweeps weekly for any it missed. Previews pushed from a workstation under other names are left alone.

## Previews

Each site's Previews live on their own Worker, `evidential-<site>-preview`, apart from production, so the token that
pushes them can't change production. They're public at
`https://<name>-evidential-<site>-preview.the-agency-fund.workers.dev`, where Cloudflare adds
`X-Robots-Tag: noindex`, and take their settings from the `previews` block in the site's `wrangler.jsonc`. A new
Preview can take a minute to start serving.

## Cloudflare resources

Everything lives on the **The Agency Fund** account (`f3fcb6f2a7fba9b85ecb03ce24e0ec48`). Each site's README lists its
own Workers and settings.

| Resource                                                           | Details                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone `evidential.dev`                                              | Pre-existing. DNS, Email Routing, and Web Analytics (automatic injection) for the domain.                                                                 |
| Workers                                                            | `evidential-www` and `evidential-docs` for production, served only at their custom domains; `evidential-www-preview` and `evidential-docs-preview`.       |
| R2 bucket `evidential-media`, custom domain `media.evidential.dev` | Large media the sites link to rather than commit, such as the docs' onboarding video under `docs/`. Public, read-only at the custom domain.               |
| Account API token `github-actions-evidential-www`                  | Workers **Editor** on `evidential-www` and `evidential-docs` only, with no zone permissions. Used by GitHub Actions for production.                       |
| Account API token `github-actions-evidential-www-preview`          | Workers **Editor** on `evidential-www-preview` and `evidential-docs-preview` only. Used by GitHub Actions for Previews, including from pull request code. |

On GitHub (`agency-fund/evidential-site`):

| Resource                 | Details                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Environment `preview`    | Used by the **preview** jobs and `preview-cleanup.yaml`; any branch.                                                               |
| Environment `production` | Used by the **production** jobs; deployments allowed only from `main`.                                                             |
| `CLOUDFLARE_ACCOUNT_ID`  | Variable in both environments.                                                                                                     |
| `CLOUDFLARE_API_TOKEN`   | Secret in each environment: `github-actions-evidential-www-preview` in `preview`, `github-actions-evidential-www` in `production`. |
| Ruleset `main`           | Changes reach `main` only through pull requests, with one approval and a passing `prek` check.                                     |

Pull request code can read the `preview` token, which is why it's scoped to the preview Workers alone. Never put the
production token in `preview`.

## Requirements

These aren't visible in the configuration files, so reproducing the setup has to account for them:

- **Custom domains**: attaching one needs _Zone › Workers Routes: Write_ on evidential.dev. CI deliberately lacks it,
  since it would let CI attach any Worker to any hostname on the zone, so each site's first production deploy came
  from a workstation (`task <site>:launch`). A custom domain owns its DNS record on the zone.
- **CI deploys versions** (`wrangler versions upload`, then `wrangler versions deploy`), which need only Workers
  Editor and never touch custom domains. Changes to `routes` or `workers_dev` in a site's `wrangler.jsonc` take a
  `wrangler deploy` from a workstation.
- **Workers must exist before CI deploys to them**, since the CI tokens can't create Workers. A preview Worker is
  created by the first `wrangler preview` pushed to it, which takes `workers_dev: false` and `preview_urls: true` from
  `wrangler.jsonc` and never gets a production version.
- **Tokens** are created in the Cloudflare dashboard, since creating one by API needs a token that can create tokens.
  Each gets the Workers role **Editor** scoped to individual Workers, and nothing else. Custom domains don't yet
  support per-Worker roles, so if a production deploy fails on authorization, the fallback is **Editor** for all of
  Workers, still with no zone permissions. `task setup:github` (`scripts/setup-github.sh`) creates the GitHub
  environments, limits `production` to `main`, and stores each token after verifying it with Cloudflare.
