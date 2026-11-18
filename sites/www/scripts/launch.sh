#!/usr/bin/env bash
# First production deploy of www.evidential.dev (`task www:launch`).
#
# Production secrets live on a Worker version, and evidential-www has no production version until this deploy, so
# TURNSTILE_SECRET is uploaded together with it (`wrangler deploy --secrets-file`). The value is read from a hidden
# prompt into a private temporary file that is deleted on exit; it never appears in command-line arguments.
#
# This deploy attaches the www.evidential.dev custom domain, so run it from a machine logged in with `wrangler login`
# (it needs Workers Routes: Write on the zone, which the CI token deliberately lacks). Later deploys keep the secret;
# rotate it with `pnpm exec wrangler secret put TURNSTILE_SECRET`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "This builds the production site and deploys it to www.evidential.dev, replacing the current www site."
read -r -p "Type 'launch' to continue: " confirm
if [[ "$confirm" != "launch" ]]; then
  echo "Canceled."
  exit 1
fi

echo "Copy the secret key of the \"evidential-www contact form\" widget from the Turnstile dashboard."
read -r -s -p "Turnstile secret key (input hidden): " secret
echo
# Turnstile secret keys are alphanumeric with - and _; rejecting anything else also keeps the dotenv file literal.
if [[ ! "$secret" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
  echo "That doesn't look like a Turnstile secret key." >&2
  exit 1
fi

secrets_file=$(mktemp)
chmod 600 "$secrets_file"
trap 'rm -f "$secrets_file"' EXIT
printf 'TURNSTILE_SECRET=%s\n' "$secret" >"$secrets_file"
unset secret

DEPLOY_ENV=production pnpm exec astro build
pnpm exec wrangler deploy --secrets-file "$secrets_file"
