/**
 * Where contact-form submissions are delivered. Every channel is notified; the visitor sees an error only if all of
 * them fail.
 *
 * - Email: the address must also be in `allowed_destination_addresses` of the CONTACT_EMAIL binding in
 *   wrangler.jsonc, and verified in Cloudflare Email Routing.
 * - Slack: create an incoming webhook for the channel (https://api.slack.com/messaging/webhooks), add its secret
 *   name (e.g. SLACK_WEBHOOK_WEBSITE_LEADS) to `secrets.required` in wrangler.jsonc, run `task www:types`, then
 *   store the URL with `pnpm exec wrangler secret put SLACK_WEBHOOK_WEBSITE_LEADS`. Never put webhook URLs here.
 */
import type { DeclaredSlackWebhookSecret, NotificationChannel } from "./notifications";

export const NOTIFICATION_CHANNELS: readonly NotificationChannel<DeclaredSlackWebhookSecret>[] = [
  { kind: "email", name: "support inbox", to: "support@evidential.dev" },
  // { kind: "slack", name: "#website-leads", webhookSecret: "SLACK_WEBHOOK_WEBSITE_LEADS" },
];
