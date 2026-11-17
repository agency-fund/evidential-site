import type { APIRoute } from "astro";
import { DEPLOY_ENV } from "astro:env/client";

// Only production is indexable; previews and local builds tell crawlers to stay out.
export const GET: APIRoute = ({ site }) => {
  const body =
    DEPLOY_ENV === "production"
      ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", site)}\n`
      : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
