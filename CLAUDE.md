# shop-passion-graphics

A single-page React storefront selling graphics, checking out via Stripe Checkout.
Static frontend on S3/CloudFront; checkout runs as an AWS Lambda behind API Gateway (SAM).

## Stack

- React 19.2 + Vite 8, **plain JSX — no TypeScript**
- Framer Motion 12 for animation
- Vitest 4 + Testing Library (jsdom)
- Stripe 22 (Checkout Sessions, `mode: 'payment'`)
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

**Installs must stay warning-free.** Two entries exist purely to keep them that way, both
fixing broken metadata inside netlify-cli's tree: a `ts-node` `packageExtensions` entry in
`.yarnrc.yml`, and an `@opentelemetry/api` pin in `resolutions`. Note `packageExtensions` can
only *add* metadata — it cannot widen a range a package already declares (yarn reports YN0069
if you try), which is why the second one is a resolution instead. Re-check both on netlify-cli
upgrades and delete them when upstream fixes the declarations.

**ESLint is held at 9.x.** ESLint 10 crashes `eslint-plugin-react` 7.37.5
(`contextOrFilename.getFilename is not a function`); that plugin and `eslint-plugin-jsx-a11y`
both cap their peer range at `^9`. Revisit when they ship v10 support.

## Architecture

- **Catalog** — `scripts/generate-products.js` reads the Stripe API and writes
  `public/products.json`. It runs at `prebuild`. The committed catalog is the fallback when no
  Stripe key is available (CI does not regenerate).
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
- **`ALLOWED_ORIGIN` has no wildcard fallback.** If it is unset, the deploy fails — it does not
  silently ship `*`.
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
| `ALLOWED_ORIGIN` | Lambda | Comma-separated origin allowlist. Required. |
| `VITE_CHECKOUT_API_URL` | build time | Public URL, not a secret. Injected from the SAM stack output by `deploy.yml`. |

`.env.local` is gitignored and must stay that way.

## Deploy

Push to `develop` → CI (lint + test + build) must pass → `deploy.yml` runs SAM, then builds the
frontend with the stack's API URL and syncs to S3.

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

The version-drift rule matters most for `context7`: this repo is on React 19.2, Vite 8, Framer
Motion 12 and Stripe 22, all newer than reliable recall. Look it up rather than assert it.

**Not applicable to this repo** — don't re-evaluate these each session:

- `shadcn` and `magic-ui` generate Tailwind components. There is no Tailwind here (no
  `tailwind.config.*`, no `postcss.config.*`, no `components.json`) and the styling is
  hand-written CSS with a deliberate maximalist look. Only relevant if Tailwind is ever adopted.
- `jira-eao-dst` belongs to a different employer and project. Never relevant here.

**Hard rules:**

- **Never** use `github`'s `push_files` or `create_or_update_file` against this repo. A push to
  `develop` triggers `deploy.yml`; commits go through local git so lint/test/build gate them
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
