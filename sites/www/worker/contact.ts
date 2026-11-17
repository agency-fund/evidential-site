/** Handles POST /api/contact: validates the form, verifies Turnstile, rate-limits, and notifies the team. */
import { FIELD_ERRORS, STARTING_POINTS } from "../src/contact";
import { NOTIFICATION_CHANNELS } from "./notifications.config";
import { describeError, log } from "./log";
import { notifyAll, type ContactSubmission, type NotificationChannel, type NotificationEnv } from "./notifications";

/** The bindings this handler uses, taken from the types `wrangler types` generates from wrangler.jsonc. */
export type ContactEnv = NotificationEnv & Pick<Env, "DEPLOY_ENV" | "CONTACT_RATE_LIMIT" | "TURNSTILE_SECRET">;

// Cloudflare's documented test secret: every token passes. Used for previews, which never send notifications.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<keyof ContactSubmission, string>>;

/** "unavailable" means Turnstile couldn't give an answer (outage, timeout, bad response), not that the visitor failed. */
type TurnstileVerdict = "passed" | "rejected" | "unavailable";

// siteverify error codes that point at our configuration or at Turnstile itself rather than at the visitor.
const TURNSTILE_SERVER_ERRORS = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Collapses whitespace (including CR/LF, which could otherwise inject email headers) and trims. */
function singleLine(value: File | string | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function validate(form: FormData): { submission: ContactSubmission } | { errors: FieldErrors } {
  const submission: ContactSubmission = {
    name: singleLine(form.get("name")),
    email: singleLine(form.get("email")),
    organization: singleLine(form.get("organization")),
    startingPoint: singleLine(form.get("startingPoint")),
    message: typeof form.get("message") === "string" ? (form.get("message") as string).trim() : "",
  };
  const errors: FieldErrors = {};
  if (!submission.name) errors.name = FIELD_ERRORS.name;
  else if (submission.name.length > 200) errors.name = "Name must be 200 characters or fewer.";
  if (!EMAIL_PATTERN.test(submission.email) || submission.email.length > 254) errors.email = FIELD_ERRORS.email;
  if (!submission.organization) errors.organization = FIELD_ERRORS.organization;
  else if (submission.organization.length > 200) errors.organization = "Organization must be 200 characters or fewer.";
  if (!(STARTING_POINTS as readonly string[]).includes(submission.startingPoint)) {
    errors.startingPoint = FIELD_ERRORS.startingPoint;
  }
  if (submission.message.length > 5000) errors.message = FIELD_ERRORS.message;
  return Object.keys(errors).length ? { errors } : { submission };
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<TurnstileVerdict> {
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  let outcome: { success?: unknown; "error-codes"?: unknown };
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      log("error", "contact.turnstile_unavailable", { status: response.status });
      return "unavailable";
    }
    const parsed: unknown = await response.json();
    if (typeof parsed !== "object" || parsed === null) {
      log("error", "contact.turnstile_unavailable", { error: "siteverify response is not a JSON object" });
      return "unavailable";
    }
    outcome = parsed;
  } catch (error) {
    log("error", "contact.turnstile_unavailable", describeError(error));
    return "unavailable";
  }
  if (outcome.success === true) return "passed";
  const errorCodes = Array.isArray(outcome["error-codes"]) ? outcome["error-codes"].map(String) : [];
  if (errorCodes.some((code) => TURNSTILE_SERVER_ERRORS.has(code))) {
    log("error", "contact.turnstile_unavailable", { errorCodes });
    return "unavailable";
  }
  log("warn", "contact.turnstile_rejected", { errorCodes });
  return "rejected";
}

export async function handleContact(
  request: Request,
  env: ContactEnv,
  channels: readonly NotificationChannel[] = NOTIFICATION_CHANNELS,
): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "POST" });

  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY_BYTES) return json({ ok: false, error: "Request too large." }, 413);

  const ip = request.headers.get("CF-Connecting-IP");
  const { success: withinLimit } = await env.CONTACT_RATE_LIMIT.limit({ key: ip ?? "unknown" });
  if (!withinLimit) return json({ ok: false, error: "Too many requests. Try again in a minute." }, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Expected a form submission." }, 400);
  }

  // Bots fill the hidden "website" field; pretend success so they don't retry.
  if (singleLine(form.get("website"))) return json({ ok: true });

  const result = validate(form);
  if ("errors" in result) return json({ ok: false, errors: result.errors }, 400);

  const isPreview = env.DEPLOY_ENV !== "production";
  const secret = isPreview ? TURNSTILE_TEST_SECRET : env.TURNSTILE_SECRET;
  if (!secret) {
    log("error", "contact.turnstile_secret_missing");
    return json({ ok: false, error: "The form is temporarily unavailable." }, 503);
  }
  const token = singleLine(form.get("cf-turnstile-response"));
  if (!token) log("warn", "contact.turnstile_rejected", { errorCodes: ["missing-input-response"] });
  const verdict = token ? await verifyTurnstile(token, secret, ip) : "rejected";
  if (verdict === "unavailable") {
    return json(
      { ok: false, error: "The form is temporarily unavailable. Email support@evidential.dev instead." },
      503,
    );
  }
  if (verdict === "rejected") {
    return json({ ok: false, error: "We couldn't verify you're human. Refresh the page and try again." }, 403);
  }

  if (isPreview) {
    log("info", "contact.preview_not_delivered", { channels: channels.length });
    return json({ ok: true, preview: true });
  }
  if (channels.length === 0) {
    log("error", "contact.no_channels_configured");
    return json({ ok: false, error: "The form is temporarily unavailable." }, 503);
  }
  const report = await notifyAll(result.submission, channels, env);
  log(report.delivered.length ? "info" : "error", "contact.delivered", { ...report });
  if (report.delivered.length === 0) {
    return json({ ok: false, error: "We couldn't send your message. Email support@evidential.dev instead." }, 502);
  }
  return json({ ok: true });
}
