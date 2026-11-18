/**
 * Builds the docs and serves dist/ the way a static host does, for the walkthrough. It deliberately doesn't use
 * `astro preview`, which overlays Astro's dev toolbar on the pages.
 */
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

export interface RunningSite {
  url: string;
  stop: () => void;
}

/** Runs `task build`, which also regenerates the API spec when needed. */
export function buildSite(siteDir: string): void {
  const result = spawnSync("task", ["build"], {
    cwd: siteDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error("task build failed");
  }
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
};

/** Resolves a request path to a file in dist/, as static hosts do: directories serve their index.html. */
async function resolveFile(
  distDir: string,
  pathname: string,
): Promise<string | undefined> {
  const file = path.normalize(path.join(distDir, decodeURIComponent(pathname)));
  if (file !== distDir && !file.startsWith(distDir + path.sep))
    return undefined;
  for (const candidate of [file, path.join(file, "index.html")]) {
    const info = await stat(candidate).catch(() => undefined);
    if (info?.isFile()) return candidate;
  }
  return undefined;
}

export async function serveSite(siteDir: string): Promise<RunningSite> {
  const distDir = path.join(siteDir, "dist");
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const file =
      (await resolveFile(distDir, pathname)) ?? path.join(distDir, "404.html");
    const status =
      file.endsWith(`${path.sep}404.html`) && !pathname.startsWith("/404")
        ? 404
        : 200;
    const info = await stat(file);
    res.writeHead(status, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "Content-Length": info.size,
    });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/`, stop: () => server.close() };
}
