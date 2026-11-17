import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("routes /api/contact to the contact handler", async () => {
  const response = await SELF.fetch("https://www.evidential.dev/api/contact");

  expect(response.status).toBe(405);
});

it("returns JSON 404s for unknown API routes", async () => {
  const response = await SELF.fetch("https://www.evidential.dev/api/nope");

  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ ok: false });
});
