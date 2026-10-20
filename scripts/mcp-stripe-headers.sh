#!/bin/sh
# Prints the Stripe MCP Authorization header from .env.local, so no MCP config holds a key copy.
# Claude Code runs it on every connection (10s timeout, no caching); see CLAUDE.md "MCP tooling".
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
