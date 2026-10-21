#!/usr/bin/env bash
# Creates the GitHub OIDC provider, deploy role and Forgejo user, stores the Stripe key as an SSM SecureString, sets GitHub environment secrets.
# Idempotent; re-run after changing bootstrap-deploy-role.yaml: bash infra/bootstrap.sh [aws-profile]

set -euo pipefail

REGION=ca-central-1
EXPECT_ACCOUNT=380069215548
STACK=shop-passion-deploy-role
PARAM_NAME=/shop-passion/staging/stripe-secret-key
GH_REPO=danieltruong/shop-passion-graphics
GH_ENV=staging

# No SITE_ORIGIN: the origin allowlist is derived from the CloudFront distribution inside
# infra/template.yaml, so nothing needs the site URL before the stack exists.

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
TEMPLATE="$ROOT/infra/bootstrap-deploy-role.yaml"
ENV_FILE="$ROOT/.env.local"

ok()   { printf '\033[32m✅ %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
die()  { printf '\033[31m❌ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 0. Clear the placeholder AWS env vars this shell ships with ───────────────────────────────
# Placeholders (local-env, xxx) override ~/.aws/credentials; real exported credentials stay.
if [ "${AWS_ACCESS_KEY_ID:-}" = "xxx" ] || [ "${AWS_PROFILE:-}" = "local-env" ]; then
  unset AWS_PROFILE AWS_DEFAULT_PROFILE AWS_REGION AWS_DEFAULT_REGION \
        AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
  info "Cleared the placeholder local-env AWS variables."
fi
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""

aws_() { aws --region "$REGION" --no-cli-pager "$@"; }

# ── 1. Choose credentials ─────────────────────────────────────────────────────────────────────
# "Can create IAM roles" is probed with a read-only IAM call, not by attempting a write.
step "Selecting AWS credentials"

can_do_iam() { aws_ iam list-open-id-connect-providers >/dev/null 2>&1; }

if [ "${1:-}" != "" ]; then
  export AWS_PROFILE="$1"
  can_do_iam || die "Profile '$1' cannot call IAM in $REGION. Needs rights to create IAM roles."
  ok "Using profile: $1"
elif [ -n "${AWS_ACCESS_KEY_ID:-}" ] && can_do_iam; then
  ok "Using credentials from the environment"
else
  chosen=""
  for p in $(aws configure list-profiles 2>/dev/null); do
    export AWS_PROFILE="$p"
    if can_do_iam; then chosen="$p"; break; fi
  done
  if [ -z "$chosen" ]; then
    unset AWS_PROFILE
    printf '\n'
    die "No available credential can create IAM roles.
   Profiles found: $(aws configure list-profiles 2>/dev/null | tr '\n' ' ')
   Re-run as:  bash infra/bootstrap.sh <admin-profile>
   or export an admin AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY first."
  fi
  export AWS_PROFILE="$chosen"
  ok "Using profile: $chosen"
fi

caller=$(aws_ sts get-caller-identity --output text --query '[Account,Arn]')
account=$(printf '%s' "$caller" | cut -f1)
info "Identity: $(printf '%s' "$caller" | cut -f2)"
[ "$account" = "$EXPECT_ACCOUNT" ] \
  || die "Wrong AWS account: got $account, expected $EXPECT_ACCOUNT. Refusing to continue."
ok "Account $account confirmed"

# ── 2. Preflight ──────────────────────────────────────────────────────────────────────────────
step "Preflight"
[ -f "$TEMPLATE" ]  || die "Missing $TEMPLATE"
[ -f "$ENV_FILE" ]  || die "Missing $ENV_FILE — the Stripe key is read from it."
command -v gh >/dev/null || die "gh CLI not found."
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

stripe_key="$(
  sed -n 's/^[[:space:]]*STRIPE_SECRET_KEY[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" \
    | head -1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" -e 's/[[:space:]]*$//'
)"
[ -n "$stripe_key" ] || die "STRIPE_SECRET_KEY is empty or missing in $ENV_FILE"
case "$stripe_key" in
  sk_test_*) ok "Stripe key found in .env.local (test mode)" ;;
  sk_live_*) die "That is a LIVE Stripe key. This bootstrap targets staging — refusing." ;;
  *)         die "STRIPE_SECRET_KEY does not look like a Stripe secret key." ;;
esac
ok "All preflight checks passed"

# ── 3. OIDC provider ──────────────────────────────────────────────────────────────────────────
# Keep Yes for a provider this stack owns, else CloudFormation deletes it and deploys fail.
step "Checking for an existing GitHub OIDC provider"
owned=$(aws_ cloudformation describe-stack-resource \
          --stack-name "$STACK" --logical-resource-id GitHubOidcProvider \
          --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || true)

if [ -n "$owned" ] && [ "$owned" != "None" ]; then
  create_oidc=Yes
  info "This stack already owns one — keeping it."
elif aws_ iam list-open-id-connect-providers --output text \
       | grep -q 'token.actions.githubusercontent.com'; then
  create_oidc=No
  info "An external one exists — the stack will reuse it."
else
  create_oidc=Yes
  info "None found — the stack will create it."
fi

# ── 4. Deploy the role stack ──────────────────────────────────────────────────────────────────
step "Deploying CloudFormation stack: $STACK"
set +e
out=$(aws_ cloudformation deploy \
        --template-file "$TEMPLATE" \
        --stack-name "$STACK" \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides "CreateOidcProvider=$create_oidc" 2>&1)
rc=$?
set -e
printf '%s\n' "$out" | sed 's/^/   /'
if [ $rc -ne 0 ] && ! printf '%s' "$out" | grep -qi 'No changes to deploy'; then
  die "Stack deploy failed (exit $rc)."
fi
role_arn=$(aws_ cloudformation describe-stacks --stack-name "$STACK" \
             --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text)
[ -n "$role_arn" ] && [ "$role_arn" != "None" ] || die "Stack produced no RoleArn output."
ok "Deploy role: $role_arn"

# ── 5. Stripe key → SSM SecureString ──────────────────────────────────────────────────────────
step "Storing the Stripe key in SSM"
aws_ ssm put-parameter \
  --name "$PARAM_NAME" \
  --type SecureString \
  --value "$stripe_key" \
  --description 'Stripe secret key for the staging checkout Lambda. Fetched at cold start.' \
  --overwrite >/dev/null
param_arn=$(aws_ ssm get-parameter --name "$PARAM_NAME" --query 'Parameter.ARN' --output text)
ok "Parameter: $param_arn"

# ── 6. GitHub environment secrets ─────────────────────────────────────────────────────────────
step "Setting GitHub secrets on the '$GH_ENV' environment"
gh secret set AWS_ROLE_ARN       --repo "$GH_REPO" --env "$GH_ENV" --body "$role_arn"
gh secret set STRIPE_SECRET_ARN  --repo "$GH_REPO" --env "$GH_ENV" --body "$param_arn"
ok "AWS_ROLE_ARN, STRIPE_SECRET_ARN set"

# deploy.yml does not read ALLOWED_ORIGIN; warn about any leftover secret so it cannot look like it controls CORS.
if gh secret list --repo "$GH_REPO" --env "$GH_ENV" 2>/dev/null | grep -q '^ALLOWED_ORIGIN'; then
  printf '\033[33m⚠️  A stale ALLOWED_ORIGIN secret exists on the %s environment.\033[0m\n' "$GH_ENV"
  info "Nothing reads it — the origin allowlist now comes from the CloudFront distribution."
  info "Remove it with:  gh secret delete ALLOWED_ORIGIN --repo $GH_REPO --env $GH_ENV"
fi

# ── 7. Summary ────────────────────────────────────────────────────────────────────────────────
step "Done"
info "Role            $role_arn"
info "SSM parameter   $param_arn"
info "Allowed origin  derived from the CloudFront distribution at deploy time"
printf '\n'
ok "Staging is provisioned. The next deploy can reach CloudFormation, Lambda, API Gateway,"
info "CloudFront and the site bucket's policy."
info "The site's HTTPS URL is the stack's SiteUrl output — deploy.yml prints it at the end of"
info "the run. The first deploy after adding CloudFront takes several extra minutes while the"
info "distribution is created."
printf '\n'
info "For Forgejo deploys, create the deploy user's key:"
info "  aws iam create-access-key --user-name shop-passion-forgejo-deploy"
info "then set Forgejo Actions secrets AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,"
info "AWS_ROLE_ARN, STRIPE_SECRET_ARN and S3_BUCKET_NAME."
