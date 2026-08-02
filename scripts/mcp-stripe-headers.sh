#!/bin/sh
# Emit the Authorization header for the Stripe MCP server (https://mcp.stripe.com).
#
# Reads the key from .env.local — the repo's existing single copy — so no Stripe credential is
# ever duplicated into an MCP config. This file and .mcp.json are both safe to commit; neither
# contains a secret.
#
# Claude Code runs this on every connection (10s timeout, no caching) and merges the JSON on
# stdout into the request headers. See CLAUDE.md → MCP tooling.
#
# The key has exactly two homes:
#   .env.local            — local dev: this script, generate-products.js, the Netlify dev function
#   AWS SSM SecureString  — production Lambda, via STRIPE_SECRET_ARN
set -eu

# Resolve the repo root from this script's own location, not $PWD — the helper runs from the
# session's working directory, which is not necessarily the repo root.
dir="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
env_file="$dir/.env.local"

[ -f "$env_file" ] || {
  echo "mcp-stripe-headers: $env_file not found (copy .env.example and add your key)" >&2
  exit 1
}

# Take the first STRIPE_SECRET_KEY assignment, strip surrounding quotes and trailing whitespace.
key="$(
  sed -n 's/^[[:space:]]*STRIPE_SECRET_KEY[[:space:]]*=[[:space:]]*//p' "$env_file" \
    | head -1 \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" -e 's/[[:space:]]*$//'
)"

[ -n "$key" ] || {
  echo "mcp-stripe-headers: STRIPE_SECRET_KEY is empty or missing in $env_file" >&2
  exit 1
}

printf '{"Authorization": "Bearer %s"}\n' "$key"
