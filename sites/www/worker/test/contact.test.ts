import { afterEach, expect, it, vi } from "vitest";
import { handleContact, type ContactEnv } from "../contact";
import type { DeclaredSlackWebhookSecret, NotificationChannel } from "../notifications";

const SLACK_URL = "https://hooks.slack.com/services/T000/B000/XXXX";
const EMAIL: NotificationChannel = { kind: "email", name: "support inbox", to: "support@evidential.dev" };
const SLACK: NotificationChannel = { kind: "slack", name: "#leads", webhookSecret: "SLACK_WEBHOOK_LEADS" };

// Tests use a Slack secret that wrangler.jsonc doesn't declare, so their env adds it explicitly.
type TestEnv = ContactEnv & { SLACK_WEBHOOK_LEADS?: string };

function makeEnv(overrides: Partial<TestEnv> = {}) {
  const send = vi.fn(async () => ({ messageId: "msg-1" }));
  const limit = vi.fn(async () => ({ success: true }));
  const env: TestEnv = {
    DEPLOY_ENV: "production",
    CONTACT_FROM: "website@evidential.dev",
    TURNSTILE_SECRET: "real-secret",
    CONTACT_EMAIL: { send } as unknown as SendEmail,
    CONTACT_RATE_LIMIT: { limit } as unknown as RateLimit,
    SLACK_WEBHOOK_LEADS: SLACK_URL,
    ...overrides,
  };
  return { env, send, limit };
}

function validForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields = {
    name: "Ada Lovelace",
    email: "ada@example.org",
    organization: "Analytical Engines",
    startingPoint: "Our data is ready",
    message: "Reminder timing",
    "cf-turnstile-response": "token-abc",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

function post(form: FormData): Request {
  return new Request("https://www.evidential.dev/api/contact", {
    method: "POST",
    body: form,
    headers: { "CF-Connecting-IP": "203.0.113.7" },
  });
}

/** Answers Turnstile verification and Slack webhook calls; anything else is a test bug. */
function mockFetch({ turnstile = true, slackStatus = 200 }: { turnstile?: boolean; slackStatus?: number } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://challenges.cloudflare.com/")) return Response.json({ success: turnstile });
    if (url === SLACK_URL) return new Response(slackStatus === 200 ? "ok" : "no_service", { status: slackStatus });
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

function mockTurnstile(success: boolean) {
  return mockFetch({ turnstile: success });
}

function slackCalls(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls.filter(([input]) => String(input) === SLACK_URL);
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("sends an email for a valid submission", async () => {
  const siteverify = mockTurnstile(true);
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  const [url, init] = siteverify.mock.calls[0]!;
  expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  const verifyBody = (init as RequestInit).body as FormData;
  expect(verifyBody.get("secret")).toBe("real-secret");
  expect(verifyBody.get("response")).toBe("token-abc");
  expect(verifyBody.get("remoteip")).toBe("203.0.113.7");
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0]).toMatchObject([
    {
      to: "support@evidential.dev",
      replyTo: { email: "ada@example.org", name: "Ada Lovelace" },
      subject: "Website inquiry: Analytical Engines",
    },
  ]);
});

it("returns field errors for invalid input", async () => {
  mockTurnstile(true);
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm({ email: "not-an-email", startingPoint: "Other" })), env);

  expect(response.status).toBe(400);
  const body = await response.json<{ errors: Record<string, string> }>();
  expect(Object.keys(body.errors).sort()).toEqual(["email", "startingPoint"]);
  expect(send).not.toHaveBeenCalled();
});

it("strips line breaks from single-line fields so they cannot inject email headers", async () => {
  mockTurnstile(true);
  const { env, send } = makeEnv();

  await handleContact(post(validForm({ organization: "Acme\r\nBcc: victim@example.com" })), env);

  expect(send.mock.calls[0]).toMatchObject([{ subject: "Website inquiry: Acme Bcc: victim@example.com" }]);
});

it("rejects submissions that fail Turnstile", async () => {
  mockTurnstile(false);
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(403);
  expect(send).not.toHaveBeenCalled();
});

it.each([
  ["the request fails", () => Promise.reject(new TypeError("Network connection lost"))],
  ["it responds with an error status", async () => new Response("Bad Gateway", { status: 502 })],
  ["it responds with something other than JSON", async () => new Response("<html>oops</html>")],
  ["it responds with JSON that isn't an object", async () => Response.json(null)],
  ["it reports a server-side error", async () => Response.json({ success: false, "error-codes": ["internal-error"] })],
  ["it rejects our secret", async () => Response.json({ success: false, "error-codes": ["invalid-input-secret"] })],
])("returns 503 and logs an error without sending when Turnstile verification %s", async (_, siteverify) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(siteverify);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(503);
  expect(send).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledOnce();
  expect(JSON.parse(String(error.mock.calls[0]![0]))).toMatchObject({
    level: "error",
    event: "contact.turnstile_unavailable",
  });
});

it("logs Turnstile's error codes when it rejects a visitor", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }),
  );
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const { env } = makeEnv();

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(403);
  expect(JSON.parse(String(warn.mock.calls[0]![0]))).toEqual({
    level: "warn",
    event: "contact.turnstile_rejected",
    errorCodes: ["timeout-or-duplicate"],
  });
});

it("pretends to accept honeypot submissions without sending", async () => {
  const siteverify = mockTurnstile(true);
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm({ website: "https://spam.example" })), env);

  expect(response.status).toBe(200);
  expect(siteverify).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("rate-limits by client IP", async () => {
  const { env, send, limit } = makeEnv();
  limit.mockResolvedValue({ success: false });

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(429);
  expect(limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
  expect(send).not.toHaveBeenCalled();
});

it("uses the Turnstile test secret and skips email on preview deployments", async () => {
  const siteverify = mockTurnstile(true);
  const { env, send } = makeEnv({ DEPLOY_ENV: "preview", TURNSTILE_SECRET: "" });

  const response = await handleContact(post(validForm()), env);

  expect(await response.json()).toEqual({ ok: true, preview: true });
  const verifyBody = (siteverify.mock.calls[0]![1] as RequestInit).body as FormData;
  expect(verifyBody.get("secret")).toBe("1x0000000000000000000000000000000AA");
  expect(send).not.toHaveBeenCalled();
});

it("reports an outage instead of sending when the production secret is missing", async () => {
  const { env, send } = makeEnv({ TURNSTILE_SECRET: "" });

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(503);
  expect(send).not.toHaveBeenCalled();
});

it("returns 502 when the email cannot be sent", async () => {
  mockTurnstile(true);
  const { env, send } = makeEnv();
  send.mockRejectedValue(new Error("E_RATE_LIMIT_EXCEEDED"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env);

  expect(response.status).toBe(502);
});

it("only accepts POST", async () => {
  const { env } = makeEnv();

  const response = await handleContact(new Request("https://www.evidential.dev/api/contact"), env);

  expect(response.status).toBe(405);
  expect(response.headers.get("Allow")).toBe("POST");
});

it("notifies every configured channel", async () => {
  const fetchSpy = mockFetch();
  const { env, send } = makeEnv();

  const response = await handleContact(post(validForm()), env, [EMAIL, SLACK]);

  expect(await response.json()).toEqual({ ok: true });
  expect(send).toHaveBeenCalledOnce();
  const [[, init]] = slackCalls(fetchSpy) as [[unknown, RequestInit]];
  const payload = JSON.parse(init.body as string);
  expect(payload.text).toBe("New website inquiry from Ada Lovelace (Analytical Engines)");
  expect(JSON.stringify(payload.blocks)).toContain("ada@example.org");
});

it("succeeds when only some channels fail", async () => {
  mockFetch({ slackStatus: 500 });
  const { env } = makeEnv();
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, [EMAIL, SLACK]);

  expect(response.status).toBe(200);
});

it("still notifies Slack when email fails", async () => {
  const fetchSpy = mockFetch();
  const { env, send } = makeEnv();
  send.mockRejectedValue(new Error("E_SENDER_NOT_VERIFIED"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, [EMAIL, SLACK]);

  expect(response.status).toBe(200);
  expect(slackCalls(fetchSpy)).toHaveLength(1);
});

it("reports failure only when every channel fails", async () => {
  mockFetch({ slackStatus: 404 });
  const { env, send } = makeEnv();
  send.mockRejectedValue(new Error("E_RATE_LIMIT_EXCEEDED"));
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, [EMAIL, SLACK]);

  expect(response.status).toBe(502);
  const logged = errors.mock.calls.map(([line]) => JSON.parse(String(line)));
  expect(logged).toEqual([
    expect.objectContaining({ event: "contact.notification_failed", channel: "email:support inbox" }),
    expect.objectContaining({ event: "contact.notification_failed", channel: "slack:#leads" }),
    { level: "error", event: "contact.delivered", delivered: [], failed: ["email:support inbox", "slack:#leads"] },
  ]);
  // Webhook URLs are credentials and must never reach the logs.
  expect(errors.mock.calls.flat().join(" ")).not.toContain("hooks.slack.com");
});

it("treats a Slack channel whose secret is missing as failed without calling anything", async () => {
  const fetchSpy = mockFetch();
  const { env } = makeEnv({ SLACK_WEBHOOK_LEADS: undefined });
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, [SLACK]);

  expect(response.status).toBe(502);
  expect(slackCalls(fetchSpy)).toHaveLength(0);
});

it("refuses to post submissions to a webhook secret that isn't a Slack URL", async () => {
  const fetchSpy = mockFetch();
  const { env } = makeEnv({ SLACK_WEBHOOK_LEADS: "https://attacker.example/collect" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, [SLACK]);

  expect(response.status).toBe(502);
  expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("attacker"))).toBe(false);
});

it("escapes Slack formatting in submitted text", async () => {
  const fetchSpy = mockFetch();
  const { env } = makeEnv();

  await handleContact(post(validForm({ message: "<!channel> see <https://evil.example|this> & that" })), env, [SLACK]);

  const [[, init]] = slackCalls(fetchSpy) as [[unknown, RequestInit]];
  const body = init.body as string;
  expect(body).not.toContain("<!channel>");
  expect(body).toContain("&lt;!channel&gt; see &lt;https://evil.example|this&gt; &amp; that");
});

it("returns 503 when no channels are configured", async () => {
  mockFetch();
  const { env } = makeEnv();
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await handleContact(post(validForm()), env, []);

  expect(response.status).toBe(503);
});

it("only lets the channel config name Slack secrets declared in wrangler.jsonc", () => {
  // Compile-time check (tsc runs in `task www:check`): no SLACK_WEBHOOK_* secret is declared yet, so a Slack channel
  // can't be configured until its secret is added to `secrets.required`.
  // @ts-expect-error SLACK_WEBHOOK_LEADS is not in secrets.required
  const channel: NotificationChannel<DeclaredSlackWebhookSecret> = SLACK;
  expect(channel.kind).toBe("slack");
});
