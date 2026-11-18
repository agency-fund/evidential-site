# docs.evidential.dev

Evidential's technical documentation, built with [Nimbus](https://nimbus-docs.com) on Astro, using the default Nimbus
theme. It was migrated from MkDocs in [agency-fund/evidential-docs](https://github.com/agency-fund/evidential-docs),
which still builds and deploys the live site until hosting moves here. Nothing in this repository deploys the docs yet.

## Development

Run these from the repository root (or drop the `docs:` prefix inside `sites/docs`):

| Command                 | What it does                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task docs:start`       | Dev server with hot reload at http://localhost:4322 (www uses 4321, so both can run). |
| `task docs:build`       | Static build into `dist/`: pages, search index, `llms.txt`, Markdown versions, and share cards.                                                    |
| `task docs:preview`     | Build, then serve `dist/` at http://localhost:4322, as it will be deployed.                                                                        |
| `task docs:check`       | `astro check`, `nimbus-docs check`, and `nimbus-docs lint`.                                                                                        |
| `task docs:lint`        | Content lint only; `task docs:lint -- --fix` applies safe fixes.                                                                                   |
| `task docs:openapi`     | Downloads the live API's spec and regenerates the reference's spec (see below). Commit the result.                                                 |
| `task docs:outdated`    | Lists Nimbus starter files and components that changed upstream.                                                                                   |
| `task docs:nimbus -- …` | Runs any `nimbus-docs` command, such as `list`, `add <slug>`, `diff <file>`, or `migrate`.                                                         |

`nimbus-docs check` reads the link index from the last build, so after adding or moving pages, run `task docs:build`
before `task docs:check`, or it reports links to the new pages as broken.

## Layout

[AGENT.md](AGENT.md) describes the project structure and is the guide for coding agents. In short:

- `src/content/docs/`: the pages, as MDX. A file's path is its URL; `index.mdx` is the home page.
- `astro.config.ts`: site settings, the sidebar, redirects from old MkDocs URLs, and the API reference's spec and
  routes.
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
- `src/components/Wordmark.astro`: the Evidential wordmark in the header, from www's logo. `src/components/logo.ts`
  is the single-colour mark on share cards.

## Design system

`src/styles/evidential.css` gives the docs www.evidential.dev's look: its navy, gold and cool greys
(`sites/www/src/styles/tokens.css`), Inter with IBM Plex Mono, bold navy headings, www's link and table styles, and
a navy-based dark mode. Gold is the single accent: the rule under each page title, the current page in the sidebar,
and cautions.

It only overrides Nimbus's `--nb-*` tokens and styles a few documented hooks, so `src/styles/globals.css` and
`prose.css` stay as Nimbus ships them and `task docs:outdated` can still update them. Change the look there, and keep
the palette in step with `sites/www` when either changes.

## Writing pages

- Frontmatter needs a `title`; the page heading comes from it, so don't repeat it as a `#` heading.
- The sidebar is set by hand in `astro.config.ts` (it mirrors the MkDocs navigation), so add new pages there.
- Callouts: `:::note`, `:::tip`, `:::caution`, `:::danger` (with an optional `[Title]`).
- Expandable sections: `<Accordion>`, `<AccordionTrigger>`, `<AccordionContent>`.
- Diagrams: Mermaid, as ``<pre class="mermaid">{`…`}</pre>``. The library loads only on pages that have one.
- Images: put them beside the page and link them relatively (`./diagram.png`), so Astro optimizes them.

## Media

The onboarding video is too large for git, so it's served from the `evidential-media` R2 bucket at
https://media.evidential.dev/docs/evidential_demo_20250709.mp4, with a poster frame in `public/media/`. To replace it,
upload a new file under a new name and update the two pages that embed it (`index.mdx` and `welcome/getting-started.mdx`):

```sh
pnpm exec wrangler r2 object put evidential-media/docs/<file>.mp4 --remote --file <file>.mp4 \
  --content-type video/mp4 --cache-control "public, max-age=31536000, immutable"
```

Object names are cached for a year, so never reuse one.

## Known issues carried over from MkDocs

- `legal/terms.mdx` is a copy of the Privacy Policy, as it was on the MkDocs site. It's left out of the sidebar until it
  has the real terms; the page still builds at `/legal/terms/`.
