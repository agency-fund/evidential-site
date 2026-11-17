#!/usr/bin/env bash
# Provisions the GitHub side of the www deployment pipeline (.github/workflows/www.yaml). Safe to re-run.
#
#   1. Environments: "preview" (pull request Previews, any branch) and "production" (deploys, main branch only).
#   2. Variable CLOUDFLARE_ACCOUNT_ID in both environments.
#   3. Secret CLOUDFLARE_API_TOKEN in each environment, a different token for each: the preview environment's can only
#      change the evidential-www-preview Worker, because pull request code can read it. Each is read from a hidden
#      prompt and verified against Cloudflare first, and never appears in command-line arguments or output.
#
# Create the Cloudflare tokens first; see "GitHub Actions Credentials" in sites/www/README.md.
#
# Usage: scripts/setup-github.sh [--skip-token]
#   --skip-token  Only create environments and variables, e.g. before the Cloudflare tokens exist.
set -euo pipefail

REPO="agency-fund/evidential-site"
CLOUDFLARE_ACCOUNT_ID="f3fcb6f2a7fba9b85ecb03ce24e0ec48"
ENVIRONMENTS=(preview production)

skip_token=false
for arg in "$@"; do
  case "$arg" in
    --skip-token) skip_token=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }

# Reads a Cloudflare token from a hidden prompt, verifies it, and stores it as the environment's CLOUDFLARE_API_TOKEN.
# An empty answer leaves the environment's current secret unchanged.
set_token() {
  local env=$1 token_name=$2 token verify status
  step "Cloudflare API token for $env ($token_name)"
  read -r -s -p "Paste the token, or press Enter to keep the current one (input hidden): " token
  echo
  if [[ -z "$token" ]]; then
    echo "Unchanged."
    return
  fi
  # Verify before storing. The header goes through stdin (-H @-) so the token never appears in process arguments.
  verify=$(printf 'Authorization: Bearer %s\n' "$token" |
    curl -sS -H @- "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify")
  status=$(jq -r '.result.status // empty' <<<"$verify")
  if [[ "$status" != "active" ]]; then
    echo "Cloudflare did not accept the token as an active account token for $CLOUDFLARE_ACCOUNT_ID:" >&2
    jq -c '.errors' <<<"$verify" >&2
    exit 1
  fi
  echo "Token verified (active)."
  # gh reads the secret from stdin when --body is omitted.
  printf '%s' "$token" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO" --env "$env"
}

step "Checking GitHub access to $REPO"
permission=$(gh repo view "$REPO" --json viewerPermission --jq .viewerPermission)
if [[ "$permission" != "ADMIN" ]]; then
  echo "Need admin access to $REPO to manage environments and secrets (have: $permission)." >&2
  exit 1
fi

step "Creating environment: preview (any branch; the workflow only runs it for same-repo pull requests)"
gh api --method PUT "repos/$REPO/environments/preview" --silent

step "Creating environment: production (deployments restricted to the main branch)"
gh api --method PUT "repos/$REPO/environments/production" --silent --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
existing_policies=$(gh api "repos/$REPO/environments/production/deployment-branch-policies" \
  --jq '[.branch_policies[] | select(.type == "branch") | .name] | join(" ")')
if [[ " $existing_policies " != *" main "* ]]; then
  gh api --method POST "repos/$REPO/environments/production/deployment-branch-policies" --silent \
    -f name=main -f type=branch
fi

for env in "${ENVIRONMENTS[@]}"; do
  step "Setting variable CLOUDFLARE_ACCOUNT_ID in $env"
  gh variable set CLOUDFLARE_ACCOUNT_ID --repo "$REPO" --env "$env" --body "$CLOUDFLARE_ACCOUNT_ID"
done

if [[ "$skip_token" == false ]]; then
  set_token preview github-actions-evidential-www-preview
  set_token production github-actions-evidential-www
fi

step "Result"
for env in "${ENVIRONMENTS[@]}"; do
  echo "[$env]"
  gh api "repos/$REPO/environments/$env" \
    --jq '"  deployment branches: " + (if .deployment_branch_policy == null then "any" else "custom" end)'
  if [[ "$env" == production ]]; then
    gh api "repos/$REPO/environments/$env/deployment-branch-policies" --jq '"  allowed: " + ([.branch_policies[].name] | join(", "))'
  fi
  gh variable list --repo "$REPO" --env "$env" | sed 's/^/  variable: /'
  gh secret list --repo "$REPO" --env "$env" | sed 's/^/  secret:   /'
done
