# shop-passion-graphics

A single-page React storefront selling graphics, checking out via Stripe Checkout.
Static frontend on S3/CloudFront; checkout runs as an AWS Lambda behind API Gateway (SAM).

## Stack

- React 19 + Vite 8, **plain JSX — no TypeScript**
- Framer Motion 14 for animation
- Vitest 5 + Testing Library (jsdom)
- Stripe 23 (Checkout Sessions, `mode: 'payment'`)
- AWS SAM → Lambda + HTTP API, region `ca-central-1`

## Commands

```bash
yarn                   # install (yarn install --immutable in CI)
yarn dev               # netlify dev on :8888 (proxies vite on :5173)
yarn test:run          # vitest (unit/component), single run
yarn coverage          # vitest with v8 coverage
yarn test:e2e          # playwright (browser), builds + previews automatically
yarn test:e2e:ui       # playwright interactive UI mode
yarn lint              # eslint (covers src/, scripts/, netlify/, lambda/)
yarn build             # vite build → dist/
yarn generate:products # regenerate the catalog from the Stripe API
```

`yarn dev` reads `.env.local` (copy `.env.example`); set `STRIPE_SECRET_KEY` to Stripe
test-mode key before checkout works. Storefront renders without it.

Inside a git worktree `netlify dev` takes the main checkout as repository root, even with
`--cwd`: the checkout function returns 404 and the main checkout gets a `.netlify/` folder.
Test the function from a normal clone.

## Pre-push verifier

Before push, run in order, every one must pass (CI `ci.yml` runs same):

```bash
yarn install --immutable && yarn lint && yarn test:run && VITE_CHECKOUT_API_URL= yarn build && yarn test:e2e
```

`yarn test:e2e` needs `yarn playwright install chromium` once per machine.

## Package manager

**Yarn 4 everywhere, including the Lambda.** One `yarn.lock` at the root covers both
workspaces; there is no `package-lock.json` anywhere and no npm step in any pipeline.

The release is **vendored** at `.yarn/releases/yarn-4.18.0.cjs` and selected by `yarnPath` in
`.yarnrc.yml`. That is not redundant with `packageManager` in `package.json`: corepack alone
means a stale global yarn fails with *"the current global version of Yarn is 1.22.22"*, which
is exactly what happened here. With `yarnPath` set, any yarn on `PATH` delegates to the
vendored one — Yarn 1 included, corepack or not.

`nodeLinker: node-modules`, not PnP: vite, netlify-cli and playwright all resolve by walking a
real `node_modules` tree.

**The Lambda is a workspace, built by a Makefile.** `lambda/create-checkout/` is listed in
root `workspaces`. SAM's *native* Node.js builder shells out to `npm install` and cannot be
pointed at yarn, so `infra/template.yaml` sets `Metadata: BuildMethod: makefile` on
`CheckoutFunction` and `lambda/create-checkout/Makefile` assembles the artifact instead.

Two settings hold that together, and breaking either ships a Lambda with no dependencies:

- `nmHoistingLimits: workspaces` keeps the function's dependencies in its *own*
  `node_modules` instead of hoisting them to the root, which is what the Makefile copies.
- `yarn install` must run before `sam build` — the Makefile deliberately does not install, so
  it cannot mutate a working tree or need network access mid-build. It fails loudly if
  `node_modules/` or `products.json` is missing.

Yarn does not hoist undeclared transitive dependencies the way npm does, so anything imported
must be declared. `@testing-library/dom` is a direct devDependency for exactly this reason —
`@testing-library/react` v16 lists it as a *peer*, npm's hoisting hid it, and the whole test
suite failed to resolve it under yarn.

**Installs must stay warning-free.** `ts-node` `packageExtensions` entry in `.yarnrc.yml`
fixes broken peer metadata inside netlify-cli's tree. `packageExtensions` can only *add*
metadata; widening declared range needs `resolutions` (yarn reports YN0069 otherwise).
Re-check on netlify-cli upgrades, delete when upstream fixes declaration.

`npmMinimalAgeGate` (Yarn default 1440 minutes) quarantines releases under day old:
`yarn up` fails with YN0016 on them. Pick previous version; do not lower gate.

**ESLint is held at 9.x.** ESLint 10 crashes `eslint-plugin-react` 7.37.5
(`contextOrFilename.getFilename is not a function`); that plugin and `eslint-plugin-jsx-a11y`
both cap their peer range at `^9`. Revisit when they ship v10 support.

## Architecture

- **Catalog** — `scripts/generate-products.js` reads the Stripe API and writes
  `public/products.json`. Runs only by hand; neither build, CI nor deploy regenerates it,
  so committed catalog is what ships. `deploy.yml` copies it into Lambda with
  `yarn sync:catalog`.
- **Cart** — state is owned by `src/App.jsx` and passed down to `Header`/`CartIcon` and
  `CartDrawer`. Persisted to `localStorage` so the Stripe cancel redirect doesn't wipe it.
  Cart lines are keyed on `stripePriceId`.
- **Checkout** — `src/components/CartDrawer.jsx` POSTs `{cart: [{priceId, quantity}]}` to the
  checkout function and redirects to the returned Stripe URL.
- **Checkout function** — the logic lives once in
  `lambda/create-checkout/checkout-core.mjs`. `lambda/create-checkout/index.mjs` (production,
  API Gateway) and `netlify/functions/create-checkout.js` (local `netlify dev` only) are thin
  event-shape adapters over it. **Never fork the core** — the two handlers previously drifted
  and a security fix landed in only one of them.

## Non-negotiables

- **The client never sends prices.** Only `priceId` + `quantity`. Amounts are authoritative on
  Stripe's side.
- **Price IDs are checked against the catalog**, not just format-validated. A well-formed
  `price_…` that isn't in `public/products.json` is rejected.
- **Redirect URLs come from `ALLOWED_ORIGIN`**, never from request headers. Deriving them from
  the `Origin`/`Host` header is an open redirect.
- **`ALLOWED_ORIGIN` has no wildcard fallback, and is not a secret.** `infra/template.yaml`
  derives it from the CloudFront distribution in the same stack
  (`https://${SiteDistribution.DomainName}`), so it cannot be unset, cannot be `*`, and cannot
  name an origin that does not exist. It was a required GitHub secret until the CloudFront
  change; that had a chicken-and-egg problem — the site's own URL had to be typed into a secret
  before the resource defining it existed, and the value in it was the HTTP-only s3-website
  endpoint. `CustomDomainOrigins` adds a custom domain on top; it is optional and goes *first*,
  because the first entry is Stripe's redirect base.
- **Money is integers in minor units.** Never format currency by hand; use
  `src/utils/formatPrice.js`, which handles zero-decimal currencies (JPY) correctly. The live
  catalog is CAD, not USD.
- **Any change to cart or price logic needs a test.**
- **Accessibility behaviour is verified in `e2e/`, not vitest.** jsdom has no layout engine and
  no real focus model, so focus traps, `prefers-reduced-motion`, and computed styles can only be
  proven in a browser. A vitest test asserting the *markup* is not evidence the behaviour works.

## Accessibility

The cart drawer is a modal dialog. It must stay unmounted when closed (an always-rendered
`aria-modal="true"` panel is announced on every page load and leaves off-screen controls
tabbable), trap focus while open, and restore focus to the cart icon on close.

The app is wrapped in `<MotionConfig reducedMotion="user">`, and CSS animations are gated on
`@media (prefers-reduced-motion: reduce)`. Do not add motion that bypasses either.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Lambda / `.env.local` | Server-side only. Never in the bundle. |
| `ALLOWED_ORIGIN` | Lambda | Comma-separated origin allowlist. Set by the SAM template from the CloudFront domain — **not** a GitHub secret. |
| `VITE_CHECKOUT_API_URL` | build time | Public URL, not a secret. Injected from the SAM stack output by `deploy.yml`. |

GitHub environment secrets consumed by `deploy.yml`: `AWS_ROLE_ARN`, `STRIPE_SECRET_ARN` and
`S3_BUCKET_NAME` are required; `CUSTOM_DOMAIN_ORIGINS` is optional and normally unset.

`.env.local` is gitignored and must stay that way.

## Deploy

Push to `main` → CI (lint + test + build + e2e) must pass → `deploy.yml` runs SAM, then builds the
frontend with the stack's API URL and syncs to S3.

**The site is served by CloudFront, not by the bucket.** The S3 *website* endpoint is HTTP-only
— it has no TLS listener, so `https://…s3-website…` times out on port 443 rather than failing
visibly, and browsers with HTTPS-First silently upgrade the URL and hang. The bucket is now
private: `SiteBucketPolicy` in `infra/template.yaml` grants `s3:GetObject` only to the
distribution via Origin Access Control, so the website endpoint is dead by design. The live URL
is the stack's `SiteUrl` output, which `deploy.yml` prints at the end of the run.

Two consequences worth knowing:

- **`infra/bootstrap-deploy-role.yaml` is not deployed by `deploy.yml`.** It grants the role the
  CloudFront and `PutBucketPolicy` permissions the stack needs. After changing it, re-run
  `bash infra/bootstrap.sh` with admin credentials or the next deploy fails mid-changeset.
- **SPA routing is CloudFront's job now.** OAC requires the S3 REST endpoint, which has no
  index-document or error-document routing, so `DefaultRootObject` and `CustomErrorResponses`
  replace them. `/success` — where Stripe returns the buyer — is a real deep link handled by
  `src/App.jsx`, and 403 must be mapped as well as 404: a private bucket answers a missing key
  with `AccessDenied`, not `NoSuchKey`.

## Docs

- `docs/AUDIT.md` — codebase audit, with fixed/deferred status per finding.

## MCP tooling

All MCP tools come from the self-hosted **mcpjungle** gateway at `http://192.168.5.22:8080/mcp`,
registered at **user scope** (`claude mcp add --scope user`, which writes the top-level
`mcpServers` in `~/.claude.json`). Deliberately not committed here — the gateway address is
machine-specific.

Note user scope is required, not merely tidier: a server under
`projects["/root/repos"].mcpServers` matches that directory *exactly* and is not inherited by
the repos inside it.

Gateway servers: `context7`, `github`, `chrome-devtools`, `browser` (Puppeteer), `shadcn`,
`magic-ui`, `jira-eao-dst`. (Verify with `curl -s http://192.168.5.22:8080/api/v0/servers`.)

**`stripe` is the exception — it is project-scoped**, declared in this repo's `.mcp.json` and
enabled per-project in `~/.claude.json`. That is deliberate: its credential is bound to *this*
repo's `.env.local`, and `half-baked-research-web` has a separate key of its own, so one global
Stripe server could only ever point at one of them. It also cannot route through the gateway —
mcpjungle stores a static bearer token, which would be a third copy of the key, and it has no
OAuth support either.

### Routing — reach for the MCP, not the ad-hoc equivalent

| Task | Use | Not |
|---|---|---|
| A library/framework API — React, Vite, Framer Motion, Stripe SDK, Vitest, Playwright | `context7`: `resolve-library-id` → `query-docs` | Recall from memory; `WebSearch` as the first resort |
| PRs, issues, code search across GitHub | `github` | `gh pr …`, curl against api.github.com |
| **CI run status and job logs** | **`gh run list` / `gh run view --log-failed`** | `github` — it has **no** Actions tools |
| Stripe products, prices, sessions, refunds | `stripe` | curl api.stripe.com; a throwaway node script |
| Lighthouse, perf trace, or network waterfall on the **deployed** site | `chrome-devtools` | — |
| Screenshot or scrape a **public** JS-heavy page | `browser` | `WebFetch` on a JS-rendered page |
| Anything pointed at **`localhost`** | the `webapp-testing` skill (Node Playwright, `e2e/*.spec.js`) | `browser` / `chrome-devtools` — both run off-box |

The version-drift rule matters most for `context7`: versions under Stack are newer than
reliable recall. Look it up rather than assert it.

**Not applicable to this repo** — don't re-evaluate these each session:

- `shadcn` and `magic-ui` generate Tailwind components. There is no Tailwind here (no
  `tailwind.config.*`, no `postcss.config.*`, no `components.json`) and the styling is
  hand-written CSS with a deliberate maximalist look. Only relevant if Tailwind is ever adopted.
- `jira-eao-dst` belongs to a different employer and project. Never relevant here.

**Hard rules:**

- **Never** use `github`'s `push_files` or `create_or_update_file` against this repo. A push to
  `main` triggers `deploy.yml`; commits go through local git so lint/test/build gate them
  first.
- The `github` server is the legacy `@modelcontextprotocol/server-github`: repos, issues, PRs
  and code search only. It cannot list workflow runs or read job logs, so `gh` stays the tool
  for anything Actions-related. `get_pull_request_status` gives check *conclusions*, not logs.

### How the rules are enforced, not just stated

Two mechanical pieces back the routing table. Keep them in sync when a rule changes.

- **`.claude/agents/*.md`** — a subagent can only call MCP tools listed in its frontmatter
  `tools:` line, so a rule here is a no-op inside an agent that wasn't granted the tool.
  `react-frontend`, `a11y-reviewer` and `playwright-tester` get `context7`; `ci-cd-expert` also
  gets the three read-only `github` tools; `security-reviewer` also gets the four read-only
  `stripe` tools. Agent definitions load at session start — edits need a restart to take effect.
- **`.claude/settings.json`** — allowlists read-only MCP tools so routine lookups don't prompt.
  Tools are enumerated one by one on purpose: a bare `mcp__mcpjungle` rule would also allow
  `merge_pull_request` and `push_files`. Everything that mutates — `stripe_api_write`,
  `create_refund`, all `github` writes, both browser MCPs — is deliberately left out and keeps
  prompting. Grant nothing that writes.

### The Stripe key has exactly two homes

| Location | Used by |
|---|---|
| `.env.local` (untracked, gitignored) | `scripts/generate-products.js`, the Netlify dev checkout function, **and the Stripe MCP server** |
| AWS SSM SecureString, via `STRIPE_SECRET_ARN` | the production Lambda, fetched at cold start by `resolveSecret()` |

**Never add a third.** MCP configs *reference* the key, they do not contain it:
`.mcp.json` points at `scripts/mcp-stripe-headers.sh`, which reads `.env.local` at connection time
and emits an `Authorization` header. Both files are safe to commit — neither holds a secret. If a
change would put the key anywhere else (a gateway, a settings file, an env block), it's the wrong
change.

The key is a **test-mode** secret key, so the full toolset — including `stripe_api_write` and
`create_refund` — operates only on sandbox data and cannot touch live money. Verified: the account
reports as `shop.passion.graphics sandbox`. Use it directly for inspecting products and prices,
checking whether a price is active, and debugging checkout sessions.

Reads are free to run. Before any `stripe_api_write` or `create_refund`, call
`get_stripe_account_info` and confirm the account is still `shop.passion.graphics sandbox` — if
it is not, stop. That check is the only thing standing between a sandbox write and a live one.

`stripe_api_read` takes a Stripe **operation ID**, not a URL path — e.g.
`{"stripe_api_operation_id": "GetPrices", "parameters": {"active": true}}`. Use `stripe_api_search`
to find the right operation ID first.

One boundary: `scripts/generate-products.js` still calls the Stripe REST API directly and must
continue to. It runs at build time and in CI, where no MCP client exists. The MCP server is for
*inspection and debugging*, not for the build path.

A second boundary: **both** browser MCPs — `browser` and `chrome-devtools` — run on the gateway
host (`192.168.5.22`), which is not this machine (`192.168.5.162`). They **cannot reach a dev
server on this machine's `localhost`**; `localhost:5173` resolves to the gateway container, not
to Vite. They are for public URLs only — the deployed CloudFront site, third-party pages. For
testing the app itself, use the `webapp-testing` skill below.

## Subagent routing

`a11y-reviewer` and `security-reviewer` in `.claude/agents/` replace user agents of same name.

| Task | Agent | Not |
|---|---|---|
| React component or hook in `src/` | `react-frontend` | `general-purpose` |
| Workflow, SAM template, deploy config | `ci-cd-expert` | `coder` alone |
| Playwright spec in `e2e/` | `playwright-tester` | `tester` for browser behaviour |
| Accessibility review | `a11y-reviewer` | `reviewer` |
| Checkout, CORS, secrets, Stripe surface | `security-reviewer` | `reviewer` alone |
| Multi-file change from a clear spec | `coder` | `general-purpose` |
| 1-2 file mechanical edit | `builder` | `coder` |
| Vitest unit or component tests | `tester` | `coder` |
| Diff or branch review | `reviewer` | same agent that wrote it |
| Find code, map callers | `investigator` | reading the tree inline |
| Unknown cause of a failure | `debugger` | guessing a fix |
| Rendered page check | `visual-check` | main-session screenshots |

## Skills

`.claude/skills/` holds project-scoped skills. Two are official Anthropic skills
(`anthropics/skills`), the rest were carried over from the Copilot conversion:

| Skill | Use for |
|---|---|
| `webapp-testing` | Playwright against the local dev server — the only way to verify the a11y fixes (focus trap, drawer unmount, Escape→focus restore, reduced motion) that jsdom cannot cover |
| `frontend-design` | Aesthetic direction when reshaping UI — this shop has a deliberate maximalist look, not a templated default |
| `a11y-standards` | WCAG 2.2 AA reference; pairs with the a11y findings in `docs/AUDIT.md` |
| `secure-coding` | OWASP review of the checkout handler and CI |
| `web-performance` | Core Web Vitals |
| `github-actions` | Editing `.github/workflows/` |
| `gsap-framer-scroll-animation` | Framer Motion scroll/entrance patterns |
| `stripe-best-practices`, `stripe-projects`, `upgrade-stripe` | Stripe docs and upgrades |

> **`webapp-testing` is written for Python Playwright; this project uses Node Playwright**
> (`@playwright/test`) so browser tests share the repo's existing JS toolchain. Follow the skill's
> reconnaissance-then-act method and its guidance on waiting for `networkidle`, but write specs in
> `e2e/*.spec.js` against `playwright.config.js` — ignore its `scripts/with_server.py` helper,
> since `webServer` in the config already manages server lifecycle natively.
