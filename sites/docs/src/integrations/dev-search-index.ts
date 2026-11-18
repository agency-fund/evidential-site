/**
 * Lets search work under `astro dev`. Pagefind indexes the built site, so the dev server has no /pagefind/ of its
 * own; this serves the last production build's index (dist/pagefind/) there instead. `task docs:start` builds first
 * when content has changed, so the index matches the pages at startup. Edits made while the server runs show up in
 * search after the next `task docs:build`, with no restart.
 *
 * Dev only: production builds write their own index, and nothing here touches dist/ or public/.
 */
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

export default function devSearchIndex(): AstroIntegration {
  return {
    name: "evidential:dev-search-index",
    hooks: {
      "astro:server:setup": ({ server, logger }) => {
        const root = fileURLToPath(new URL("../../dist/pagefind/", import.meta.url));
        let warned = false;
        server.middlewares.use("/pagefind/", (req, res, next) => {
          const path = normalize(join(root, decodeURIComponent((req.url ?? "/").split("?")[0])));
          if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) return next();
          let size: number;
          try {
            const stat = statSync(path);
            if (!stat.isFile()) return next();
            size = stat.size;
          } catch {
            if (!warned) {
              warned = true;
              logger.warn("No search index in dist/pagefind/: run `task docs:build` to search in dev.");
            }
            return next();
          }
          res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
          res.setHeader("Content-Length", size);
          res.setHeader("Cache-Control", "no-store");
          createReadStream(path).pipe(res);
        });
      },
    },
  };
}
