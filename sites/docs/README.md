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
| `task docs:outdated`    | Lists Nimbus starter files and components that changed upstream.                                                                                   |
| `task docs:nimbus -- …` | Runs any `nimbus-docs` command, such as `list`, `add <slug>`, `diff <file>`, or `migrate`.                                                         |

`nimbus-docs check` reads the link index from the last build, so after adding or moving pages, run `task docs:build`
before `task docs:check`, or it reports links to the new pages as broken.

## Layout

[AGENT.md](AGENT.md) describes the project structure and is the guide for coding agents. In short:

- `src/content/docs/`: the pages, as MDX. A file's path is its URL; `index.mdx` is the home page.
- `astro.config.ts`: site settings and the sidebar.
- `src/components/`, `src/layouts/`, `src/styles/`: the Nimbus starter, ours to edit. Components under
  `src/components/ui/` come from the Nimbus registry (`task docs:nimbus -- add <slug>`) and are recorded in
  `nimbus.json`. Keep them identical to upstream unless there's a reason not to, so `task docs:outdated` and
  `nimbus-docs diff` stay useful.
- `src/components/Wordmark.astro`: the Evidential wordmark in the header, from www's logo. `src/components/logo.ts`
  is the single-colour mark on share cards.

## Writing pages

- Frontmatter needs a `title`; the page heading comes from it, so don't repeat it as a `#` heading.
