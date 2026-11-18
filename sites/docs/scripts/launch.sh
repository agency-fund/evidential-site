#!/usr/bin/env bash
# First production deploy of docs.evidential.dev (`task docs:launch`).
#
# This deploy attaches the docs.evidential.dev custom domain, so run it from a machine logged in with `wrangler login`
# (it needs Workers Routes: Write on the zone, which the CI token deliberately lacks). The old site's CNAME still holds
# the hostname, so wrangler asks to replace that DNS record; answer yes.
# Later deploys come from CI and leave the custom domain unchanged.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "This builds the production site and deploys it to docs.evidential.dev, replacing the MkDocs site."
read -r -p "Type 'launch' to continue: " confirm
if [[ "$confirm" != "launch" ]]; then
  echo "Cancelled."
  exit 1
fi

task build
pnpm exec wrangler deploy
