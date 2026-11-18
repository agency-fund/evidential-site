# Evidential Public Websites

## Repository layout

This repository holds Evidential's public websites. Each site lives in its own directory under `sites/`, with its
own `Taskfile.yml` and GitHub Actions workflow:

| Directory    | Site                                               | Status                                                                                                         |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `sites/www`  | [www.evidential.dev](https://www.evidential.dev)   | Astro static site plus a small Cloudflare Worker for the contact form                                          |
| `sites/docs` | [docs.evidential.dev](https://docs.evidential.dev) | Nimbus (Astro) docs site, with the OpenAPI reference |

## Getting started

Requirements: [pnpm](https://pnpm.io), [Task](https://taskfile.dev), and [prek](https://prek.j178.dev).

```sh
task setup        # install dependencies and git hooks
task www:start    # dev server with hot reload at http://localhost:4321
task docs:start   # docs dev server at http://localhost:4322
task check        # type checks, formatting, and tests for every site
task lint         # all pre-commit hooks
task --list       # everything else
```

See [sites/www/README.md](sites/www/README.md) for editing content and how deployments work. See [sites/docs/README.md](sites/docs/README.md) for the docs
site, and [Contribute to the docs](sites/docs/src/content/docs/develop/guides/contribute-to-the-docs.mdx) to propose a change to it.
