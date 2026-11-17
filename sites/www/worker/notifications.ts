/** Delivers contact-form submissions to every configured channel (email and Slack incoming webhooks). */
import { describeError, log } from "./log";

export interface ContactSubmission {
  name: string;
  email: string;
  organization: string;
  startingPoint: string;
  message: string;
}

/** Wrangler secret holding a Slack incoming-webhook URL, e.g. SLACK_WEBHOOK_WEBSITE_LEADS. */
export type SlackWebhookSecret = `SLACK_WEBHOOK_${string}`;

export interface EmailChannel {
  kind: "email";
  /** Used in logs. */
  name: string;
  /** Must be listed in the CONTACT_EMAIL binding's allowed_destination_addresses in wrangler.jsonc. */
  to: string;
}

export interface SlackChannel<Secret extends SlackWebhookSecret = SlackWebhookSecret> {
  kind: "slack";
  /** Used in logs, e.g. "#website-leads". The webhook URL itself is never logged. */
  name: string;
  /** Set with `wrangler secret put <name>`; webhook URLs are credentials and are never committed. */
  webhookSecret: Secret;
}

/**
 * Slack webhook secrets declared in `secrets.required` in wrangler.jsonc (and therefore in the generated Env).
 * Typing the channel config with this makes enabling a Slack channel without declaring its secret a type error.
 */
export type DeclaredSlackWebhookSecret = Extract<keyof Env, SlackWebhookSecret>;

export type NotificationChannel<Secret extends SlackWebhookSecret = SlackWebhookSecret> =
  EmailChannel | SlackChannel<Secret>;

/** The bindings delivery uses, from the generated Env. Slack secrets are looked up by name; see webhookUrl(). */
export type NotificationEnv = Pick<Env, "CONTACT_FROM" | "CONTACT_EMAIL">;

export interface DeliveryReport {
  delivered: string[];
  failed: string[];
}

const SLACK_TIMEOUT_MS = 8_000;
// Slack rejects section text over 3,000 characters.
const SLACK_TEXT_LIMIT = 2_900;

export function formatEmail(submission: ContactSubmission): { subject: string; text: string } {
  return {
    subject: `Website inquiry: ${submission.organization}`,
    text: [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      `Organization: ${submission.organization}`,
      `Starting point: ${submission.startingPoint}`,
      "",
      "What they'd like to test:",
      submission.message || "(not provided)",
    ].join("\n"),
  };
}

/** Escapes Slack mrkdwn control characters so submissions can't inject links or @channel mentions. */
export function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function formatSlack(submission: ContactSubmission): object {
  const field = (label: string, value: string) => ({ type: "mrkdwn", text: `*${label}*\n${escapeSlack(value)}` });
  return {
    text: `New website inquiry from ${escapeSlack(submission.name)} (${escapeSlack(submission.organization)})`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "New website inquiry" } },
      {
        type: "section",
        fields: [
          field("Name", submission.name),
          field("Email", submission.email),
          field("Organization", submission.organization),
          field("Starting point", submission.startingPoint),
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*What they'd like to test*\n${escapeSlack(truncate(submission.message || "(not provided)", SLACK_TEXT_LIMIT))}`,
        },
      },
    ],
  };
}

async function sendEmail(channel: EmailChannel, submission: ContactSubmission, env: NotificationEnv): Promise<void> {
  const { subject, text } = formatEmail(submission);
  await env.CONTACT_EMAIL.send({
    from: { email: env.CONTACT_FROM, name: "Evidential website" },
    to: channel.to,
    replyTo: { email: submission.email, name: submission.name },
    subject,
    text,
  });
}

/** Reads a Slack webhook secret by name; the channel config only allows names declared in wrangler.jsonc. */
function webhookUrl(env: NotificationEnv, secret: SlackWebhookSecret): string | undefined {
  const value: unknown = Reflect.get(env, secret);
  return typeof value === "string" && value !== "" ? value : undefined;
}

async function sendSlack(channel: SlackChannel, submission: ContactSubmission, env: NotificationEnv): Promise<void> {
  const url = webhookUrl(env, channel.webhookSecret);
  if (!url) throw new Error(`secret ${channel.webhookSecret} is not set`);
  if (!url.startsWith("https://hooks.slack.com/"))
    throw new Error(`secret ${channel.webhookSecret} is not a Slack webhook URL`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formatSlack(submission)),
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Slack responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

/** Notifies every channel in parallel. One failing channel never prevents the others from being notified. */
export async function notifyAll(
  submission: ContactSubmission,
  channels: readonly NotificationChannel[],
  env: NotificationEnv,
): Promise<DeliveryReport> {
  const results = await Promise.allSettled(
    channels.map((channel) =>
      channel.kind === "email" ? sendEmail(channel, submission, env) : sendSlack(channel, submission, env),
    ),
  );
  const report: DeliveryReport = { delivered: [], failed: [] };
  results.forEach((result, i) => {
    const name = `${channels[i]!.kind}:${channels[i]!.name}`;
    if (result.status === "fulfilled") report.delivered.push(name);
    else {
      report.failed.push(name);
      log("error", "contact.notification_failed", { channel: name, ...describeError(result.reason) });
    }
  });
  return report;
}
