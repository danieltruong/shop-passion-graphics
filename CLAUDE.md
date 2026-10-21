# shop-passion-graphics

React storefront for graphics with Stripe Checkout. Static frontend on S3/CloudFront; checkout
is AWS Lambda behind API Gateway (SAM, region `ca-central-1`).

Stack: React 19 + Vite 8, **plain JSX, no TypeScript**; react-router 8; Framer Motion 14; Vitest 5 + Testing
Library (jsdom); Stripe 23 (Checkout Sessions, `mode: 'payment'`); AWS SAM → Lambda + HTTP API.

## Commands

```bash
yarn                   # install (yarn install --immutable in CI)
yarn dev               # vite on :5173 (strictPort); vite.config.js middleware serves /api/create-checkout
yarn test:run          # vitest (unit/component), single run
yarn coverage          # vitest with v8 coverage
yarn test:e2e          # playwright (browser), builds + previews automatically
yarn test:e2e:ui       # playwright interactive UI mode
yarn lint              # eslint (covers src/, scripts/, lambda/, e2e/)
yarn build             # vite build → dist/
yarn generate:products # regenerate the catalog from the Stripe API
```

`yarn dev` reads `.env.local` (copy `.env.example`). Checkout needs test-mode
`STRIPE_SECRET_KEY` and `ALLOWED_ORIGIN=http://localhost:5173`; storefront renders without.

## Pre-push verifier

Run in order before push; every one must pass (CI `ci.yml` runs same):

```bash
yarn install --immutable && yarn lint && yarn test:run && VITE_CHECKOUT_API_URL= yarn build && yarn test:e2e
```

`yarn test:e2e` needs `yarn playwright install chromium` once per machine.

## Package manager

Yarn 4 everywhere, Lambda included: one root `yarn.lock`, no `package-lock.json`, no npm step.

- Release vendored at `.yarn/releases/yarn-4.18.0.cjs`, picked by `yarnPath` in
  `.yarnrc.yml`, so any yarn on `PATH` (Yarn 1 too) delegates to it.
- `lambda/create-checkout/` workspace built by its `Makefile` (`BuildMethod: makefile`),
  since SAM's Node.js builder runs `npm install`. `nmHoistingLimits: workspaces` keeps deps
  in own `node_modules` for Makefile to copy. Run `yarn install` before `sam build`:
  Makefile never installs, fails without `node_modules/` or `products.json`.
- Yarn does not hoist undeclared transitive dependencies: declare every import
  (`@testing-library/dom` direct devDependency for this reason).
- Installs stay warning-free except YN0060/YN0086: `eslint-plugin-jsx-a11y` 6.10.2 caps
  ESLint peer at `^9`. `packageExtensions` only adds metadata; widening range needs
  `resolutions` (else YN0069); no `patch:` widens peer range.
- `npmMinimalAgeGate` (Yarn default 1440 minutes) blocks releases under a day old; `yarn up`
  fails with YN0016. Pick previous version; do not lower gate.
- ESLint 10 runs without `eslint-plugin-react`: 7.37.5 crashes with
  `contextOrFilename.getFilename is not a function`. Revisit both plugins once they support v10.

## Architecture

- **Layout**: pages in `src/pages/`, shared UI in `src/components/`, copy and placeholders in
  `src/content/site.js`, money formatted as `$12.00 CAD` by `src/utils/formatPrice.js`.
- **Catalog**: `scripts/generate-products.js` reads Stripe API, writes
  `public/products.json`. Run by hand only; committed catalog ships. `deploy.yml` copies it
  into Lambda with `yarn sync:catalog`. Each entry has `slug`, `category`, `badge`
  (`new` | `sold_out` | null), `images` (up to 8) and `paymentLink` (`buy.stripe.com` only),
  taken from Stripe product metadata and active Payment Links.
- **Cart**: state owned by `src/App.jsx`, passed to `SiteHeader` and `CartDrawer`, kept
  in `localStorage` so Stripe cancel redirect does not wipe it. Lines keyed on `stripePriceId`.
  `CART_ENABLED` in `src/features.js` is `true`: `CartDrawer` mounted, opens from header cart
  button or on rejected add, product pages add to cart. Checkout creates Stripe Checkout
  Session through Lambda. Flag stays kill switch: `false` unmounts drawer, pages link to
  Payment Link.
- **Checkout**: `src/components/CartDrawer.jsx` POSTs `{cart: [{priceId, quantity}]}` and
  redirects to returned Stripe URL.
- **Checkout function**: logic lives once in `lambda/create-checkout/checkout-core.mjs`.
  `lambda/create-checkout/index.mjs` (production, API Gateway) and `checkoutDevApi` plugin in
  `vite.config.js` (`yarn dev` only) are thin adapters. **Never fork the core.**

## Non-negotiables

- **Client never sends prices**, only `priceId` + `quantity`; amounts live in Stripe.
- **Price IDs checked against `public/products.json`**, not just format-validated.
- **Redirect URLs come from `ALLOWED_ORIGIN`**, never from `Origin`/`Host` header (open
  redirect).
- **`ALLOWED_ORIGIN` has no wildcard fallback and is not a secret.** `infra/template.yaml`
  derives from CloudFront distribution (`https://${SiteDistribution.DomainName}`).
  Optional `CustomDomainOrigins` goes *first*: first entry is Stripe's redirect base.
- **Money is integers in minor units.** Format only with `src/utils/formatPrice.js` (handles
  zero-decimal currencies like JPY). Live catalog is CAD, not USD.
- **Any change to cart or price logic needs a test.**
- **Accessibility behaviour verified in `e2e/`, not vitest**: jsdom has no layout engine or
  real focus model, markup assertions do not prove focus traps, reduced motion or styles.

## Accessibility

Cart drawer modal dialog: unmounted when closed (always-rendered `aria-modal="true"` panel
announced on load), traps focus while open, restores focus to control that opened it (cart
button, or Add button after rejected add) on close. Motion goes through
`<MotionConfig reducedMotion="user">` or CSS gated on `@media (prefers-reduced-motion: reduce)`;
never around them.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `.env.local` | Server-side only, never in bundle. Production uses `STRIPE_SECRET_ARN` (SSM). |
| `ALLOWED_ORIGIN` | Lambda / `.env.local` | Comma-separated origin allowlist. Production value from SAM template, **not** CI secret. |
| `VITE_CHECKOUT_API_URL` | build time | Public URL. `deploy.yml` injects from SAM stack output; unset, CartDrawer uses `/api/create-checkout`. |

Forgejo repo secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ROLE_ARN`, `STRIPE_SECRET_ARN`, `S3_BUCKET_NAME`
required; `CUSTOM_DOMAIN_ORIGINS` optional. GitHub environments hold same set minus both keys until cutover. `.env.local` stays gitignored.
Forgejo has no environments, so secrets reach every branch's workflows: any push to Forgejo can assume deploy role; who can push bounds access.

## Deploy

Forgejo (`http://192.168.3.55:3000/daniel/shop-passion-graphics`) runs `.forgejo/workflows/`: push to `main` → CI
(lint + test + build + e2e) must pass → `deploy.yml` runs SAM, builds frontend with stack's API URL, syncs to S3.

- **AWS sign-in**: Forgejo issues no OIDC token AWS accepts; IAM user `shop-passion-forgejo-deploy` (key in Forgejo
  secrets) assumes role `shop-passion-deploy`. `.github/workflows/` deploys via OIDC until cutover; edit both.
- **Push order**: GitHub and Forgejo both deploy on push to `main`; push `main` to `github` remote only after Forgejo deploy finishes (concurrency per platform; two `sam deploy` runs collide).
- **CloudFront serves site, not bucket**; bucket is private (`SiteBucketPolicy`, Origin
  Access Control). Live URL is stack's `SiteUrl` output.
- **`deploy.yml` does not deploy `infra/bootstrap-deploy-role.yaml`.** After changing it, run
  `bash infra/bootstrap.sh` with admin credentials or the next deploy fails mid-changeset.
- **SPA routing** is `react-router` in `src/App.jsx`: routes `/`, `/products/:slug`, `/about`,
  `/faq`, `/shipping`, `/success` (Stripe's return URL), `/privacy` and `*`. CloudFront
  `DefaultRootObject` and `CustomErrorResponses` serve `index.html` for deep links; map 403 as
  well as 404, since private bucket answers missing key with `AccessDenied`.

## MCP tooling

Gateway servers (`context7`, `forgejo`, `github`, `chrome-devtools`, `browser`, `shadcn`, `magic-ui`,
`jira-eao-dst`) from mcpjungle at `http://192.168.5.22:8080/mcp`, user scope, never
committed. `stripe` project-scoped in `.mcp.json`. Register with `claude mcp add --scope user`:
`projects["…"].mcpServers` not inherited below; `.claude/agents/*.md` edits need restart.

- Library APIs (React, Vite, Framer Motion, Stripe SDK, Vitest, Playwright): `context7`, not recall or WebSearch.
- Stripe products, prices, sessions, refunds: `stripe`, not curl `api.stripe.com` or throwaway node script.
- PRs, issues, code search: `forgejo`, not `gh pr …`; `github` only for the GitHub copy until cutover.
- Lighthouse, performance checks on deployed site: `chrome-devtools`.
- Screenshot/scrape public JS-heavy page: `browser`, not WebFetch.
- CI run status: `forgejo` list_workflow_runs / get_workflow_run; logs: repo page `/actions` (no log tool); GitHub runs until cutover: `gh run list` / `gh run view --log-failed`.
- **Never** write files through `forgejo` or `github` MCP (`push_files`, `create_or_update_file`): push to `main` deploys.
- `browser` and `chrome-devtools` run on `192.168.5.22`, cannot reach this machine's `localhost`: use `webapp-testing`.
- `shadcn`, `magic-ui` (no Tailwind here) and `jira-eao-dst` (other employer) never apply.
- MCP grants in `.claude/agents/*.md` `tools:` and `.claude/settings.json` stay read-only, one
  tool each: bare `mcp__mcpjungle` rule would also allow `merge_pull_request` and `push_files`.
- `stripe_api_read` takes operation ID (`GetPrices`), not URL; find with
  `stripe_api_search`. `scripts/generate-products.js` keeps calling REST API (no MCP in CI).

**The Stripe key has two homes**: `.env.local` (generate-products.js, Vite dev checkout
middleware, Stripe MCP via `scripts/mcp-stripe-headers.sh`) and AWS SSM via
`STRIPE_SECRET_ARN` (production Lambda, `resolveSecret()`). Never add third. Before any
`stripe_api_write` or `create_refund`, `get_stripe_account_info` must report
`shop.passion.graphics sandbox`; otherwise stop.

## Subagent routing

`a11y-reviewer` and `security-reviewer` in `.claude/agents/` replace user agents of same name.

| Task | Agent | Not |
|---|---|---|
| React component or hook in `src/` | `react-frontend` | `general-purpose` |
| Workflow, SAM template, deploy config | `ci-cd-expert` | `coder` alone |
| Playwright spec in `e2e/` | `playwright-tester` | `tester` |
| Accessibility review | `a11y-reviewer` | `reviewer` |
| Checkout, CORS, secrets, Stripe surface | `security-reviewer` | `reviewer` alone |

## Skills and docs

Project skills live in `.claude/skills/`. `webapp-testing` targets Python Playwright; here write
Node specs in `e2e/*.spec.js` against `playwright.config.js`, whose `webServer` replaces
`.claude/skills/webapp-testing/scripts/with_server.py`. `docs/AUDIT.md` is codebase audit.
