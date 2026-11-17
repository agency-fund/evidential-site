import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: { bindings: { TURNSTILE_SECRET: "test-secret" } },
    }),
  ],
  test: { include: ["worker/test/**/*.test.ts"] },
});
