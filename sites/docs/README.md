# docs.evidential.dev

Evidential's technical documentation, built with [Nimbus](https://nimbus-docs.com) on Astro, with www.evidential.dev's
design system (see [Design system](#design-system)). It replaces the MkDocs site in
[agency-fund/evidential-docs](https://github.com/agency-fund/evidential-docs), and every URL that site served redirects
to its page here (see `src/redirects.ts`). CI deploys pull request Previews and production from this repository (see
[Deployment](#deployment)).

To contribute to the docs, including the pull request workflow and writing conventions, see
[Contribute to the docs](src/content/docs/develop/guides/contribute-to-the-docs.mdx). This README covers how the site is built.

## Development

Run these from the repository root (or drop the `docs:` prefix inside `sites/docs`):

| Command                 | What it does                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task docs:start`       | Dev server with hot reload at http://localhost:4322 (www uses 4321, so both can run). Builds first if content changed, so search works; see below. |
| `task docs:build`       | Static build into `dist/`: pages, search index, `llms.txt`, Markdown versions, and share cards.                                                    |
| `task docs:preview`     | Build, then serve `dist/` at http://localhost:4322, as it will be deployed.                                                                        |
| `task docs:check`       | `astro check`, `nimbus-docs check`, and `nimbus-docs lint`.                                                                                        |
| `task docs:lint`        | Content lint only; `task docs:lint -- --fix` applies safe fixes.                                                                                   |
| `task docs:openapi`     | Downloads the live API's spec and regenerates the reference's spec (see below). Commit the result.                                                 |
| `task docs:outdated`    | Lists Nimbus starter files and components that changed upstream.                                                                                   |
| `task docs:nimbus -- …` | Runs any `nimbus-docs` command, such as `list`, `add <slug>`, `diff <file>`, or `migrate`.                                                         |

`nimbus-docs check` reads the link index from the last build, so after adding or moving pages, run `task docs:build`
before `task docs:check`, or it reports links to the new pages as broken.

Search is built by Pagefind from the production build, so the dev server has no index of its own.
`src/integrations/dev-search-index.ts` serves the last build's index (`dist/pagefind/`) to `task docs:start`, which
builds first whenever anything under `src/` or `astro.config.ts` changed since the last build. Edits made while the dev
server runs reach search after `task docs:build`, with no restart.

## Layout

[AGENT.md](AGENT.md) describes the project structure and is the guide for coding agents. In short:

- `src/content/docs/`: the pages, as MDX. A file's path is its URL; `index.mdx` is the home page.
- `astro.config.ts`: site settings, the sidebar's top level, and the API reference's spec and routes.
- `src/redirects.ts`: every URL the site has served (including the MkDocs site's) mapped to its page now. Astro serves
  them in dev, and the build writes them to `dist/_redirects` so Cloudflare answers with 301s. When a page moves,
  update its entries there.
- `src/api/`: the API reference's inputs. Nimbus doesn't read remote specs, so `task docs:openapi` saves the live API's
  spec as `openapi.upstream.json`, and `scripts/polish-openapi.mjs` turns it into `openapi.json`, the spec the reference
  at `/api` is built from. The script adds `overview.md` as the reference's introduction, splits the operations into
  sections, dedents descriptions, and fills in missing parameter descriptions; `task docs:start` and `task docs:build`
  rerun it when its inputs change. A new operation must be added to its `TAGS` list, and if its URL can't be derived,
  the build says so: pin it in `routes.operations` in `astro.config.ts`.
- `src/pages/api/[...slug].astro` and `src/components/ui/api-*/`: the reference's route and its components.
- `src/components/`, `src/layouts/`, `src/styles/`: the Nimbus starter, ours to edit. Components under
  `src/components/ui/` come from the Nimbus registry (`task docs:nimbus -- add <slug>`) and are recorded in
  `nimbus.json`. Keep them identical to upstream unless there's a reason not to, so `task docs:outdated` and
  `nimbus-docs diff` stay useful.
- `src/components/wordmark.ts`: the Evidential wordmark, from www's logo. `Wordmark.astro` draws it in the header,
  and the share cards (`src/pages/og/_card.ts`) draw it in the brand's colors.

## Design system

`src/styles/evidential.css` gives the docs www.evidential.dev's look: its navy, gold and cool grays
(`sites/www/src/styles/tokens.css`), Inter with IBM Plex Mono, bold navy headings, www's link and table styles, and
a navy-based dark mode. Gold is the single accent: the rule under each page title, the current page in the sidebar,
and cautions.

It only overrides Nimbus's `--nb-*` tokens and styles a few documented hooks, so `src/styles/globals.css` and
`prose.css` stay as Nimbus ships them and `task docs:outdated` can still update them. Change the look there, and keep
the palette in step with `sites/www` when either changes.

## Writing pages

- Frontmatter needs a `title`; the page heading comes from it, so don't repeat it as a `#` heading.
- Put a page in its section's folder: `guides/` and `concepts/` for people using Evidential, `develop/` and
  `operate/` for those building and running it, `news/` for release notes. Folders become sidebar groups, and
  `sidebar.order` in the frontmatter sets a page's place in its group.
- How-to titles are imperative ("Run tests"), concepts are noun phrases ("Background workers"), and the file name is
  the title in kebab case.
- Callouts: `:::note`, `:::tip`, `:::caution`, `:::danger` (with an optional `[Title]`).
- Expandable sections: `<Accordion>`, `<AccordionTrigger>`, `<AccordionContent>`.
- Diagrams: Mermaid, as ``<pre class="mermaid">{`…`}</pre>``. The library loads only on pages that have one.
- Images: put them beside the page and link them relatively (`./diagram.png`), so Astro optimizes them.

## Media

The onboarding video is too large for git, so it's served from the `evidential-media` R2 bucket at
https://media.evidential.dev/docs/evidential_demo_20250709.mp4, with a poster frame in `public/media/`. To replace it,
upload a new file under a new name and update the two pages that embed it (`index.mdx` and `quickstart.mdx`):

```sh
pnpm exec wrangler r2 object put evidential-media/docs/<file>.mp4 --remote --file <file>.mp4 \
  --content-type video/mp4 --cache-control "public, max-age=31536000, immutable"
```

Object names are cached for a year, so never reuse one.

## Deployment

The docs deploy to Cloudflare like www, through the same reusable workflows (`.github/workflows/docs.yaml` calls
`site-check.yaml`, `site-preview.yaml`, and `site-production.yaml`), and the same GitHub environments and tokens:

- **Pull requests**: `task docs:ci:check` (build, type check, Nimbus check, content lint). Same-repo, non-Dependabot pull
  requests that change `src/`, `public/`, `astro.config.ts`, or the spec's polish script also get a Preview,
  `task docs:deploy:preview NAME=pr-<number>`, on the `evidential-docs-preview` Worker, with its URL commented on the
  pull request. `preview-cleanup.yaml` deletes it when the pull request closes.
- **`main`**: `task docs:ci:deploy:production` deploys the `evidential-docs` Worker, served at docs.evidential.dev
  through the custom domain in `wrangler.jsonc`. To redeploy without a change, run the **docs** workflow manually on
  `main`.

Workers Static Assets serves `dist/`, applying the 301s in `dist/_redirects` (generated from `src/redirects.ts`) before
any file. To roll back a bad deploy, run `pnpm exec wrangler rollback` from `sites/docs`, then revert the change on
`main` so the next deploy doesn't bring it back.

Builds fetch the full git history (`fetch-depth: 0`) for pages' "Last updated" dates and the sitemap.

One-time setup, from a workstation logged in with `pnpm exec wrangler login`, before the first pull request or merge:

1. Create both Workers, which the CI tokens can't: `evidential-docs` with the [first deploy](#first-deploy), and
   `evidential-docs-preview` with a throwaway Preview:

   ```sh
   task docs:deploy:preview NAME=bootstrap
   pnpm exec wrangler preview delete --worker-name evidential-docs-preview --name bootstrap
   ```

2. Add `evidential-docs` to the scope of the `github-actions-evidential-www` token, and `evidential-docs-preview` to
   `github-actions-evidential-www-preview` (Cloudflare dashboard, **Account API tokens**). See "GitHub Actions
   Credentials" in `sites/www/README.md`.

### First deploy

Switches docs.evidential.dev from the MkDocs site, served by GitHub Pages, to this site. Run it from a workstation,
not CI: attaching the custom domain needs _Zone › Workers Routes: Write_ on evidential.dev, which the CI token
deliberately doesn't have.

1. Log in: `pnpm exec wrangler login`, as a member of The Agency Fund account.
2. Run `task docs:launch` and type `launch` to confirm. It builds the site and runs `wrangler deploy`, which attaches
   the `docs.evidential.dev` custom domain and its certificate. The `docs` CNAME to GitHub Pages still holds the
   hostname, so wrangler asks whether to update the conflicting DNS record to point to this Worker: answer yes, and it
   replaces the record in one step.
3. Check `https://docs.evidential.dev`, and that an old MkDocs URL such as `/development/workers/` answers with a 301
   to its new page.
4. In agency-fund/evidential-docs' **Settings › Pages**, remove the custom domain, so GitHub Pages no longer claims
   it.

Later deploys come from CI and leave the custom domain unchanged. To go back to the MkDocs site, remove the custom
domain from `evidential-docs` (Workers › **Settings › Domains & Routes**) and recreate the CNAME.

## Sharing the current state with the team

`task docs:walkthrough` builds the docs, serves `dist/` as a static host would, and writes these files to
`walkthrough/output/` (gitignored):

| File                  | Contents                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `walkthrough.mp4`     | 30-second, 1280×1024 H.264 tour: home, a diagram, search, the API reference, and dark mode      |
| `share-previews.webp` | The home page's link preview in WhatsApp, Substack, Telegram, LinkedIn, Facebook, and Instagram |

It needs `ffmpeg` with libx264. Pass `ONLY=video` or `ONLY=cards` to regenerate one. The tour is in
`walkthrough/video.ts`, with a target start time per step. The recorder and share cards are www's modules
(`sites/www/scripts/walkthrough/`), including the Chromium font settings that keep Inter's spacing intact on Linux.

The share cards show the page's social card, drawn by `src/pages/og/_card.ts` after www's: the wordmark, a gold
eyebrow with the page's section, the title in navy with the gold rule, and a navy band.

## Known issues carried over from MkDocs

- `legal/terms.mdx` is a copy of the Privacy Policy, as it was on the MkDocs site. It's left out of the sidebar until it
  has the real terms; the page still builds at `/legal/terms/`.
