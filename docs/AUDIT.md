# Codebase Audit — shop-passion-graphics

**Date:** 2026-08-01 · **Baseline commit:** `b814501` (branch `develop`)

This is the durable record of a full audit of the frontend, checkout backend, infrastructure,
CI/CD, and test suite. Most findings were fixed in the same pass, which erases the evidence —
this document is what preserves it.

Severity is about consequence, not effort. `Fixed` means a code change landed **and** a test or
config change locks the behaviour in. `Deferred` means it is real and unfixed; the reason is
stated.

**Result: 47 findings — 44 fixed, 3 deferred.**

**Update 2026-08-02:** the accessibility fixes below that were marked "needs manual browser
confirmation" are now covered by an automated Playwright suite (`e2e/accessibility.spec.js`,
20 tests across normal and `prefers-reduced-motion` projects, wired into CI). A11Y-01, A11Y-02,
A11Y-07, A11Y-08, A11Y-12 and TEST-01 are verified in a real browser rather than asserted in
jsdom. See `CLAUDE.md` → Skills.

| Area | Findings | Fixed | Deferred |
|---|---|---|---|
| Security & backend | 13 | 12 | 1 |
| Frontend correctness | 11 | 11 | — |
| Accessibility | 12 | 12 | — |
| Testing | 5 | 5 | — |
| CI/CD | 6 | 5 | 1 |

---

## A note on the starting point

Two claims in the repo were **factually wrong**, and both had been used to justify shipping:

1. Commit `09507ab` ("fall back to `'*'` when ALLOWED_ORIGIN is unset") stated *"Lambda-level
   CORS still validates the actual origin."* It did not. `corsHeaders()` only chose a header
   value — it never rejected a request. See SEC-03.
2. `CartDrawer.jsx` carried comments citing *"a11y: 2.4.3 Focus Order"* and *"a11y: 2.1.2 No
   Keyboard Trap"* on code that implemented neither. See A11Y-01 and A11Y-02.

Both are worth calling out because a comment asserting compliance is worse than no comment: it
stops the next reader from checking.

---

## Security & backend

### SEC-01 · Open redirect in the checkout function — **HIGH** · Fixed
`netlify/functions/create-checkout.js:35-40, 91-92`

`getOrigin()` read `Origin`, then `Host` + `X-Forwarded-Proto` — all attacker-controlled from
curl — and interpolated the result into `success_url` and `cancel_url`. An attacker could mint a
Checkout Session that sent the **paying customer** to `https://evil.tld/success?session_id=cs_…`,
combining a phishing landing page with disclosure of the session id.

The AWS Lambda copy had already been fixed to use `ALLOWED_ORIGIN`; the fix was never backported.
`netlify.toml` still defined a `[build]` block publishing `netlify/functions`, so if the Netlify
site remained connected this handler was publicly reachable, not merely local.

**Fix:** redirect URLs now come from `siteOrigin()` in the shared core, which reads the first
`ALLOWED_ORIGIN` entry and throws if unset. Locked by `checkoutCore.test.js` →
*"is the first allowed origin — never a request header"*.

### SEC-02 · No catalog allowlist for price IDs — **HIGH** · Fixed
`netlify/…:23, 68-75` · `lambda/…:24, 101-108`

Validation was a *format* check only: `/^price_[A-Za-z0-9]+$/`. Any price ID in the Stripe
account was accepted — archived prices, internal discount prices, a $0.50 test price, or a
subscription price passed to `mode: 'payment'`. `public/products.json` already held the
authoritative list and was never consulted.

**Fix:** `buildLineItems()` loads the catalog (memoized per container) and rejects anything not
in it with `400 Unknown product`. `scripts/sync-catalog.js` copies `public/products.json` into
the Lambda bundle before `sam build`, because `CodeUri: ../lambda/create-checkout/` means SAM
packages only that directory. Locked by *"rejects a well-formed price ID that is not in the
catalog"*.

### SEC-03 · CORS never rejected anything, and defaulted to `*` — **HIGH** · Fixed
`lambda/…:50-64` · `deploy.yml:73` · `infra/template.yaml:28`

Three independent wildcard fallbacks, any one of which shipped `Access-Control-Allow-Origin: *`
when `ALLOWED_ORIGIN` was unset:

```js
const origin = matched ? requestOrigin : (allowed[0] ?? '*')   // index.mjs:57
"AllowedOrigin=${{ secrets.ALLOWED_ORIGIN || '*' }}"           // deploy.yml:73
Default: '*'                                                    # template.yaml:28
```

The function still processed the request and created a session regardless of origin — CORS only
governed whether the *browser* surfaced the response. Any website got a free
Stripe-session-minting endpoint.

**Fix:** `corsHeaders()` returns `null` for an unlisted origin and `handleCheckout` turns that
into a `403` before any Stripe call. The template parameter has no default and an
`AllowedPattern`; `deploy.yml` fails fast if the secret is missing. Locked by three tests
including *"never emits a wildcard when ALLOWED_ORIGIN is unset"*.

### SEC-04 · Multi-origin `ALLOWED_ORIGIN` broke every preflight — **MEDIUM** · Fixed
`lambda/…:12-13` vs `infra/template.yaml:59-60`

The handler documented and parsed `ALLOWED_ORIGIN` as comma-separated, but the template passed
`!Ref AllowedOrigin` as a **single** `AllowOrigins` entry. Setting `"https://a,https://b"`
registered one bogus origin `"https://a,https://b"` with API Gateway, so all browser preflights
failed while the function believed both were allowed.

**Fix:** `AllowOrigins: !Split [',', !Ref AllowedOrigin]`.

### SEC-05 · Stripe secret stored as a plaintext Lambda env var — **MEDIUM** · Fixed
`infra/template.yaml:81` · `deploy.yml:72`

The key was passed on the `sam deploy` command line (visible in the runner's process argv, and
echoed verbatim by `--debug`) and then stored as a plaintext Lambda environment variable, readable
by anyone with `lambda:GetFunctionConfiguration` or console access.

**Fix:** only `STRIPE_SECRET_ARN` travels through CloudFormation. The function fetches the key
from SSM SecureString at cold start via a memoized `resolveSecret()`, with a scoped
`SSMParameterWithSlashPrefixReadPolicy` and a `kms:Decrypt` grant conditioned on
`kms:ViaService = ssm`.

### SEC-06 · No idempotency key — **MEDIUM** · Fixed
`netlify/…:82` · `lambda/…:118`

A double-click, a client retry, or an API Gateway retry each created a distinct Checkout Session.

**Fix:** `idempotencyKey()` derives a SHA-256 over the sorted, normalized line items, so the same
cart reuses the same session. Locked by three tests including *"ignores line ordering"*.

### SEC-07 · No webhook, no payment verification — **MEDIUM** · **Deferred**
Repo-wide: `grep -rn "webhook\|constructEvent"` returns zero hits.

There is no `checkout.session.completed` consumer and no signature verification. Fulfilment is
implicitly *"the user reached `/success`"* — and the session id in that URL is client-supplied and
trivially forgeable.

**Why deferred:** this needs a decision the audit cannot make — where fulfilment state lives
(there is no database), and whether these digital goods need automated fulfilment at all. The new
`SuccessBanner` component documents in-code that it is a *display* confirmation only, not proof of
payment. **This must be resolved before taking live payments.**

### SEC-08 · Stripe client constructed outside `try` — **MEDIUM** · Fixed
`netlify/…:78` · `lambda/…:111`

`new Stripe(process.env.STRIPE_SECRET_KEY)` sat before the `try` block. A missing or malformed key
threw synchronously → unhandled rejection → API Gateway `502` with **no CORS headers**, so the
browser reported a misleading CORS error instead of a configuration error. No `apiVersion` was
pinned either, leaving behaviour exposed to a Stripe-side default bump.

**Fix:** the client is constructed inside `createSession()`, within the caller's try block, with
`apiVersion` pinned. Locked by *"returns a generic 500 without leaking Stripe or config details"*,
which also asserts CORS headers are present on the 500.

### SEC-09 · No abuse controls on an unauthenticated endpoint — **MEDIUM** · Fixed
`infra/template.yaml:54-89`

No throttling, no usage plan, no auth. Combined with wildcard CORS, unlimited session creation
could be driven against the Stripe key from anywhere.

**Fix:** `DefaultRouteSettings` with `ThrottlingBurstLimit: 20`, `ThrottlingRateLimit: 10`.
The endpoint is necessarily unauthenticated (it runs before checkout), so a rate ceiling is the
available control.

### SEC-10 · Two divergent copies of the checkout handler — **MEDIUM** · Fixed
`netlify/functions/create-checkout.js` vs `lambda/create-checkout/index.mjs`

~85% identical, with `PRICE_ID_RE`, `MAX_LINE_ITEMS`, and `MAX_QTY` copy-pasted. They had already
drifted — SEC-01's fix landed in one copy only, which is exactly the failure mode duplication
produces. Compounding it, `eslint.config.js:9` ignored `lambda/`, so the **production** handler
was never linted; `npm run lint` passing said nothing about deployed code.

**Fix:** all logic lives in `lambda/create-checkout/checkout-core.mjs`. Both handlers are now
~35-line event-shape adapters. `lambda/` is linted.

### SEC-11 · Stripe SDK five majors adrift, with no lockfile — **MEDIUM** · Fixed
root `package.json:22` (`^22.3.2`) vs `lambda/create-checkout/package.json:7` (`^17.7.0`)

`lambda/create-checkout/` had no `package-lock.json`, so `sam build` re-resolved dependencies
fresh on every deploy — non-reproducible builds and an unpinned supply-chain surface, against a
version five majors from what was tested locally.

**Fix:** aligned to `^22.3.2` and committed `lambda/create-checkout/package-lock.json`.

### SEC-12 · Duplicate line items not merged — **LOW** · Fixed
Stripe renders duplicate `price` entries as separate rows for the same product. The comment at
`netlify/…:25-26` also said "up to 100" beside `MAX_LINE_ITEMS = 20`.

**Fix:** quantities are merged per price ID before the Stripe call, and the merged total is
re-checked against `MAX_QTY`. Comment corrected.

### SEC-13 · Raw Stripe response bodies echoed to stdout — **LOW** · Fixed
`scripts/generate-products.js:83, 221`

The full response body was interpolated into thrown errors and printed, sending Stripe payloads
into public CI logs.

**Fix:** only the status code and Stripe's own `error.message` are surfaced.

### Secrets: clean
Verified — **nothing secret has ever been committed**:
- `git ls-files | grep -Ei '(^dist/|^\.netlify|env)'` → only `.env.example`
- `git log --all -p | grep -oE 'AKIA[A-Z0-9]{6}'` → empty
- Commits `4552175` ("rotate IAM credentials") and `35285e0` are **empty commits** documenting
  IAM changes in their messages only
- `dist/` and `.netlify/` are untracked build residue, correctly gitignored

`.env.local` holds a real `sk_test_51Tb…` (107 chars). It is untracked and gitignored and never
reached git — but it is on this filesystem, so **rotate it if this host or image is shared**.

One scanner false positive to expect: the OWASP instructions file (now removed) contained
`const API_KEY = 'sk_live_abc123def456';` as a documented anti-pattern.

---

## Frontend correctness

### FE-01 · Currency rendered wrong for the live catalog — **HIGH** · Fixed
`ProductCard.jsx:30` · `CartDrawer.jsx:146, 187` · `generate-products.js:195`

Four copies of `{currency} ${(price / 100).toFixed(2)}`. The live catalog is **CAD**, so the shop
literally rendered `CAD $100.00`. For a zero-decimal currency the arithmetic is also wrong —
¥1500 is 1500 yen, and `/100` rendered it as `JPY $15.00`.

**Fix:** `src/utils/formatPrice.js` derives the minor-unit exponent from
`Intl.NumberFormat(...).resolvedOptions()` rather than assuming 100. Seven tests including the
JPY case; a regression test asserts the string `CAD $` never appears.

### FE-02 · Subtotal summed across currencies — **HIGH** · Fixed
`CartDrawer.jsx:51-52`

Nothing stopped a USD and a CAD product coexisting. The subtotal added raw integers across them
and labelled the result with whatever `cart[0]` happened to be — then Stripe rejected the session
with an opaque 500.

**Fix:** `addToCart` rejects a currency mismatch with a user-facing explanation. `generate-products.js`
warns at generation time when the catalog spans currencies.

### FE-03 · `??` instead of `||` on the checkout URL — **HIGH** · Fixed
`CartDrawer.jsx:29-30`

`??` does not catch `''`, and Vite substitutes a declared-but-empty env var as exactly that. The
result was `fetch('')` — a POST to the current page, returning `index.html` with HTTP 200, so the
empty-body guard never fired and `JSON.parse` threw `Unexpected token '<'` in the user's face.

This was directly reachable: `deploy.yml:92` produced an empty string whenever the SAM step failed
(CI-05) and `VITE_CHECKOUT_API_URL` was unset.

**Fix:** `||`, plus a `JSON.parse` guard producing a readable message. Locked by *"surfaces a
readable message when the API returns HTML instead of JSON"*, which asserts the user never sees
the parser error.

### FE-04 · Unvalidated redirect target — **MEDIUM** · Fixed
`CartDrawer.jsx:92-97`

A malformed 200 left `data.url` undefined and navigated the browser to the literal string
`"undefined"` — a blank 404 with the cart apparently gone. `setLoading(false)` also ran in a
`finally` after navigation had begun.

**Fix:** the URL must match `https://…stripe.com/` or an error is shown. `loading` stays true
through a successful navigation. Three tests, including an `evil.tld` rejection.

### FE-05 · Cart lost on every refresh and on checkout cancel — **MEDIUM** · Fixed
`App.jsx:19`

`useState([])` with no persistence. Stripe's `cancel_url` returns the customer to `/` — so
cancelling a checkout, a first-class flow, destroyed everything they had assembled.

**Fix:** `loadCart`/`saveCart` persist **keys and quantities only**, never a price snapshot;
lines are re-hydrated from the live catalog so prices cannot go stale and archived products drop
out. Eight persistence tests, including tampered and malformed storage.

### FE-06 · Cart keyed on product, not price — **MEDIUM** · Fixed
`App.jsx:33` · `CartDrawer.jsx:137`

The checkout payload is price-based (`CartDrawer.jsx:70`), but lines were keyed on `productId`. A
Stripe product with two prices would collapse into one line while sending only one price.

**Fix:** `lineKey()` returns `stripePriceId`, falling back to `productId`.

### FE-07 · No client-side quantity cap — **MEDIUM** · Fixed
`App.jsx:47-57` · `CartDrawer.jsx:166`

The backend enforced `MAX_QTY = 99`; the client did not. A user could build a valid-looking cart
with a correct-looking subtotal and then hit a generic `"Invalid quantity"` at checkout, with no
indication of which item. `CartIcon.jsx:24` already had `'99+'` display logic, proving the state
was reachable.

**Fix:** `MAX_QTY`/`MAX_LINE_ITEMS` mirrored in `src/utils/cart.js`; the increment button disables
at the cap and `updateQuantity` clamps.

### FE-08 · Failed fetch indistinguishable from an empty shop — **MEDIUM** · Fixed
`App.jsx:26-27` · `ProductSection.jsx:18`

A failed fetch was swallowed into `console.error`, leaving `products` as `[]` — which rendered
*"Products coming soon… the artist is still creating 🎨"*. A CDN outage looked like a shop with
nothing for sale. `App.test.jsx:48-54` actively enshrined this as correct behaviour. The fetch
also rejected with a bare string (`App.jsx:24`), discarding the stack.

**Fix:** a distinct `loadError` state renders an alert with a retry control. Rejections are
`Error` instances. Two tests assert the two states are distinguishable.

### FE-09 · Placeholder image path pointed at a missing file — **LOW** · Fixed
`generate-products.js:151`

Fell back to `/product_placeholder.webp`; the file in the repo is `product_placeholder.svg`. Any
product without an image got a hard 404 and a broken-image icon, with no `onError` handler.

**Fix:** correct path plus an `onError` fallback on `ProductCard`, guarded against a fallback loop.

### FE-10 · Module-scope `Math.random()` — **LOW** · Fixed
`Footer.jsx:4`

Evaluated at import time, making the component non-deterministic in tests and a hydration
mismatch waiting to happen.

**Fix:** moved into a `useState` initializer.

### FE-11 · No error boundary — **LOW** · Fixed
`main.jsx:8-12`

Any render-time throw blanked the entire page to white with no message.

**Fix:** `ErrorBoundary` with a reload affordance, plus `createRoot(..., { onUncaughtError })`.
Two tests.

---

## Accessibility

### A11Y-01 · Cart drawer always mounted, always tabbable, always `aria-modal` — **HIGH** · Fixed
`CartDrawer.jsx:112-119` · `App.css:339-362`

The dialog rendered unconditionally with `role="dialog" aria-modal="true"`, hidden only by
`transform: translateX(100%)` — no `display`, no `visibility`, no `inert`. Two concrete failures:

- **Keyboard:** with the cart closed, tabbing past the footer landed on the off-screen Close
  button, then the quantity buttons, then Checkout. Focus vanished off-screen.
- **Screen readers:** an open modal dialog was announced on **every page load**, and the drawer's
  contents were traversable during normal reading.

The backdrop was already gated on `isOpen` at line 103; the panel was not.

**Fix:** the whole drawer is gated on `isOpen` inside `<AnimatePresence>`, keeping the exit
animation. Two tests assert nothing is in the DOM or the a11y tree when closed.

### A11Y-02 · No focus trap, no focus restoration — **HIGH** · Fixed
`CartDrawer.jsx:36-48`

The comments claimed WCAG 2.4.3 and 2.1.2 compliance. In reality focus moved in and nothing kept
it there — Tab walked straight out into the page behind, which was not `inert`. On close via
Escape, backdrop, or ✕, focus was **not** returned to the cart icon; it landed on `<body>`, so the
next Tab restarted at the top of the document. That is the actual 2.4.3 violation the comment
claimed to have fixed.

**Fix:** a real Tab/Shift+Tab trap that also recovers focus if it escapes the dialog. `App` stores
the trigger element and restores focus on close. Four tests, including the round trip through
Escape.

### A11Y-03 · One `aria-live` region per cart line — **MEDIUM** · Fixed
`CartDrawer.jsx:157-161`

Five items meant five live regions — and each was created at the moment its item was added. Live
regions must exist in the DOM *before* their content mutates to announce reliably, so the first
change after adding an item was frequently silent in NVDA/JAWS.

**Fix:** a single `role="status"` region outside the list, summarising item count and subtotal.
Test asserts exactly one status region regardless of cart size.

### A11Y-04 · Decorative emoji announced to screen readers — **MEDIUM** · Fixed
`Header.jsx:24, 30, 44` · `Hero.jsx:18, 50-52` · `Footer.jsx:21`

The header read as *"sparkle, sparkle, shop dot passion dot graphics… star, sparkles, star"*.
`.decoration { pointer-events: none }` handled the mouse but not assistive tech.

**Fix:** `aria-hidden="true"` throughout, and `eslint-plugin-jsx-a11y` now catches the class.

### A11Y-05 · Redundant alt text on cart thumbnails — **MEDIUM** · Fixed
`CartDrawer.jsx:138-142`

`alt={product.name}` on an image immediately beside `<p>{product.name}</p>`, so every item was
announced twice.

**Fix:** `alt=""`. These thumbnails are decorative.

### A11Y-06 · Blinking text with no pause mechanism — **MEDIUM** · Fixed (WCAG 2.2.2)
`Footer.jsx:33` · `theme.css:106-109`

`animation: blink 1s infinite`, inline, ungated. Content blinking beyond five seconds requires a
pause/stop/hide mechanism.

**Fix:** six iterations rather than infinite (under the five-second threshold), moved to a `.blink`
class, and disabled under reduced motion. Opacity floor raised from 0 to 0.35.

### A11Y-07 · Unstoppable marquee — **MEDIUM** · Fixed (WCAG 2.2.2)
`App.css:216-222` · `Hero.jsx:41-43`

`animation: marquee 15s linear infinite` with no control.

**Fix:** a real pause/resume button with `aria-pressed`, plus a reduced-motion gate.

### A11Y-08 · `prefers-reduced-motion` honoured by exactly one rule — **MEDIUM** · Fixed
`App.css:356-358` was the *only* occurrence in the codebase.

Running unconditionally: `rainbow-shift 3s infinite` on every heading, `spin-slow 8s`, `float 3s`,
`wobble 2s`, `pulse-glow 2s`, `marquee 15s`, `blink 1s`. On the Framer Motion side,
`useReducedMotion` and `MotionConfig` appeared **nowhere** — every spring, `whileHover`, and
`whileInView` ran at full amplitude.

**Fix:** a global `@media (prefers-reduced-motion: reduce)` block in `theme.css`, plus
`<MotionConfig reducedMotion="user">` wrapping the app — one line covering all of Framer Motion.
The test harness can now toggle the preference (`setReducedMotion()`), which the old stub made
impossible.

### A11Y-09 · Contrast failures — **MEDIUM** · Fixed (WCAG 1.4.3, 1.4.11)
- `.btn-buy.disabled` (`App.css:162-167`): `#000` on a `#888→#555` gradient at `opacity: 0.7` ≈
  **3.6:1** at 20.8px non-bold — below the 4.5:1 threshold (the large-text exemption needs 24px,
  or 18.66px bold). This is the "Coming Soon" button, on screen for real products today.
- `.cart-clear-btn` (`App.css:545`): its `rgba(255,215,0,0.3)` border was the only thing
  identifying it as a control, at ≈**2.4:1** — below the 3:1 of 1.4.11 Non-text Contrast.

**Fix:** new `--disabled-bg` / `--disabled-text` tokens (light text on a darker solid, no opacity
trick); clear-button border alpha raised to 0.75.

### A11Y-10 · `.rainbow-text` invisible in forced-colors mode — **MEDIUM** · Fixed
`theme.css:64-66`

`-webkit-text-fill-color: transparent` + `background-clip: text`. Windows High Contrast strips
background images, leaving transparent text — so the site title, **all** section headings, the
hero tagline, and the cart title disappeared entirely.

**Fix:** `@media (forced-colors: active)` restoring `CanvasText`.

### A11Y-11 · Loading state not announced — **LOW** · Fixed
`App.jsx:65`

No `role="status"`, no `aria-live`. Screen reader users got silence, then a page that had
spontaneously changed.

**Fix:** `role="status"`. Also, the loading state no longer unmounts the header, footer, and
drawer — the previous early return remounted the entire chrome after the fetch, guaranteeing
layout shift.

### A11Y-12 · Skip-link target with no skip link — **LOW** · Fixed
`App.jsx:74`

`id="main-content" tabIndex={-1}` existed purely as a skip-link target, and grepping `src/` and
`index.html` for "skip" returned nothing. Inert scaffolding that read as completed a11y work —
and there was a genuine need, since the header puts decorations and the cart button before
`<main>`.

**Fix:** a real `.skip-link`, visible on focus, as the first focusable element. Test asserts it
takes the first Tab.

---

## Testing

### TEST-01 · IntersectionObserver mock never fired — **HIGH** · Fixed
`src/test/setup.js:4-8`

The stub implemented `observe()` as a no-op, so `whileInView` never triggered and **every**
element under `ProductSection` and `Hero` rendered stuck in the `hidden` variant at `opacity: 0`.
Tests queried by role and passed anyway. A regression leaving the entire shop grid permanently
invisible would not have been caught by any test.

**Fix:** the mock reports observed elements as intersecting, delivered asynchronously as the real
API does.

### TEST-02 · Two tests passed regardless of the implementation — **MEDIUM** · Fixed
- `App.test.jsx:28-35` asserted the loading state **synchronously**, before any microtask
  flushed. It passed whether `fetch` was mocked or not, resolved or rejected — `loading` is
  initialised to `true`, so the first paint always shows the spinner. The elaborate
  never-resolving-promise setup asserted nothing.
- `ProductSection.test.jsx:26-34` had two tests for the single `if (!products || products.length
  === 0)` branch.

**Fix:** the loading test now controls promise resolution and asserts the transition *out* of
loading; the duplicate cases are one test with a rerender.

### TEST-03 · Stale fixture tested the opposite branch from its name — **MEDIUM** · Fixed
`App.test.jsx:5-17`

The mock product had `paymentLink` but **no `stripePriceId`**, so `ProductCard.jsx:39` rendered the
*disabled "Coming Soon"* button — a leftover from the pre-cart Payment Links architecture. The
consequence: *"renders coming soon when fetch fails"* matched `/coming soon/i`, which the **success**
path also produced. The test did not discriminate the failure it claimed to test.

**Fix:** one shared `src/test/fixtures.js`, with the divergence documented in-file.

### TEST-04 · All money logic untested — **HIGH** · Fixed
`CartDrawer.jsx` (216 lines) had **zero** tests. So did `CartIcon.jsx` and every cart reducer in
`App.jsx` — the most defect-prone logic in the app. There were no accessibility assertions
anywhere.

**Fix:** 10 tests → **129**. Coverage is 88% statements / 86% branches, with the checkout core at
83% and `CartDrawer` at 98%.

| Suite | Covers |
|---|---|
| `cart.test.js` | reducers, currency guard, quantity caps, persistence, tampered storage |
| `CartDrawer.test.jsx` | subtotal, line totals, focus trap, Escape, all six checkout failure paths |
| `checkoutCore.test.js` | CORS policy, catalog allowlist, cart validation, idempotency, redirect origin |
| `formatPrice.test.js` | CAD/USD/EUR + zero-decimal JPY |
| `CartIcon.test.jsx` | badge summation, `99+`, singular/plural label |
| `ErrorBoundary.test.jsx` | fallback render, success banner |

### TEST-05 · `npm run coverage` was broken — **LOW** · Fixed
`package.json:16` ran `vitest run --coverage`, but `@vitest/coverage-v8` was not in
`devDependencies` and not in `node_modules`. The command errored on first use. There were also no
thresholds, and `css: true` was unset so class-dependent behaviour was never exercised.

**Fix:** provider installed, `css: true`, and 70% thresholds as a floor.

---

## CI/CD

### CI-01 · Tests never ran in CI — **CRITICAL** · Fixed
`.github/workflows/ci.yml:18`

The job was named **"Lint, Test & Build"** and the steps were checkout → setup-node → `npm ci` →
lint → build → verify → upload. There was no test step, and `git log -p -- .github/workflows/ci.yml`
confirms there never was one. The test suite had **literally never executed in CI**.

**Fix:** a `Test` step running `npm run test:run`.

### CI-02 · Deploy not gated on CI — **HIGH** · Fixed
`deploy.yml:5-6`

`deploy.yml` triggered independently on push to `develop` with no `needs:` or `workflow_run:`, and
ran neither lint nor tests. A commit that failed CI deployed anyway, in parallel with the failing
run.

**Fix:** `ci.yml` gained `workflow_call`; the deploy job declares `needs: ci`.

### CI-03 · `continue-on-error` hid failed API deploys — **HIGH** · Fixed
`deploy.yml:63` (from commit `b814501`)

Three compounding consequences:

1. The job reported **green** when the entire checkout API failed to deploy.
2. GitHub runs `run:` under `bash -e`, so a `sam deploy` failure aborted the step before line 82 —
   `steps.sam.outputs.checkout_url` was never set. Line 92 fell back to
   `secrets.VITE_CHECKOUT_API_URL`, and if that was also unset the bundle shipped with an **empty**
   checkout URL, triggering FE-03. Silent production breakage behind a green pipeline.
3. "Deploy to S3" ran with `--delete` regardless, publishing a fresh frontend pointing at an API
   that did not exist.

**Fix:** removed, plus `set -euo pipefail`, an explicit guard on an empty/`None` stack output, and
a pre-flight secret check that fails fast with a readable message.

### CI-04 · `--output text` prints the literal `None` — **MEDIUM** · Fixed
`deploy.yml:77-82`

When the stack output was absent, the bundle shipped with `VITE_CHECKOUT_API_URL="None"` —
non-empty, so every fallback was bypassed and every checkout request went to a URL named "None".

**Fix:** explicit `[ "$CHECKOUT_URL" = "None" ]` check that fails the deploy.

### CI-05 · OIDC regression, and the Stripe key exposed to every build — **MEDIUM** · Fixed
Commit `55fe4e6` introduced OIDC; `f23e220` replaced it with long-lived
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, which then needed manual rotation in `4552175`.
Separately, `ci.yml:40` exposed `STRIPE_SECRET_KEY` to every build **including `pull_request`**,
because `prebuild` invoked `generate-products.js`. Fork PRs do not receive secrets, but any
in-repo branch PR editing a workflow or a build script could have exfiltrated it.

**Fix:** OIDC restored (`id-token: write` + `role-to-assume`). `prebuild` removed — catalog
generation is now an explicit, manual step — so CI no longer needs the key at all.

### CI-06 · `|| true` swallowed failed uploads — **MEDIUM** · Fixed
`deploy.yml:106-108`

`[ -f dist/products.json ] && aws s3 cp … || true` caught a *failed upload* as well as a missing
file, so the product catalog could silently fail to publish.

**Fix:** unconditional `aws s3 cp` under `set -euo pipefail`; CI verifies `dist/products.json`
exists.

### CI-07 · No `/success` route — **MEDIUM** · **Deferred (partially fixed)**
`success_url` points at `${origin}/success`, but there was no router and no `/success` component.
`public/_redirects` is a Netlify-only file that S3 ignores, and `infra/template.yaml` defines no
S3 or CloudFront resources at all — the bucket and distribution are managed out-of-band via
`secrets.S3_BUCKET_NAME` / `secrets.CLOUDFRONT_DISTRIBUTION_ID`. So a paying customer landed on an
S3 404.

**Fixed:** `SuccessBanner` renders the confirmation and clears the spent cart; `public/_redirects`
is now tracked (it was untracked, so CI builds differed from local ones).

**Deferred:** CloudFront must be configured with a custom error response mapping 403/404 →
`/index.html` (200) for the route to resolve at all. That resource is not in the template, so it
cannot be fixed in code from here. **Without this change, the `/success` route still 404s in
production.**

### CI-08 · No dependabot — **LOW** · Fixed
Actions are correctly pinned to full commit SHAs — good practice, but pins rot without automation,
and `configure-aws-credentials` was already behind.

**Fix:** `.github/dependabot.yml` covering npm (root), npm (`lambda/create-checkout`), and
github-actions.

---

## Code quality

Lower-severity items, all fixed.

**`scripts/generate-products.js`**
- No pagination on `/v1/products` or `/v1/payment_links` (`:100`, `:175` used `limit=100` with no
  follow-up) — catalogs above 100 items silently truncated. Now paginates via `starting_after`.
- Re-fetched `/v1/prices/{id}` **sequentially, once per product** (`:134-141`) despite already
  requesting `expand[]=data.default_price` (`:175`). N redundant serialized round-trips removed.
- A missing key exited **0** with a warning (`:42-51`) — silently shipping a stale catalog — while
  every other error exited 1. The dangerous case was the silent one. Now fails loudly.
- The hand-rolled `.env.local` parser (`:23-37`) did not strip surrounding quotes, so
  `KEY="sk_..."` produced a key containing quote characters and a mystifying 401. Now strips
  quotes and tolerates `export `.
- Wrote directly into the **tracked** `public/products.json` on every build, so committed and
  deployed catalogs drifted with no signal. No longer runs at `prebuild`.

**Dead code removed**
- The entire `paymentLink` subsystem (~40 lines of `fetchPaymentLinks`, plus fields, logging, and
  warnings) — **no frontend code ever read it**; superseded by the `stripePriceId` + Checkout
  Session flow. Also stripped from `public/products.json`.
- `VIEWPORTS.withMargin` / `.repeat`, `DURATIONS.slow` / `.verySlow`, `DELAYS.none`
- `.starburst` (16 lines), `.wordart-outline`
- Unused tokens: `--rainbow-magenta`, `--card-border`, `--card-border-gold`, `--border-blue`,
  `--glow-rainbow`, `--bg-cloud-3`
- Unreferenced `public/assets/{starburst,sparkle,under-construction}.svg`

**`eslint.config.js`**
- `varsIgnorePattern: '^[A-Z_]'` (`:60`) exempted **every capitalized identifier** — every
  component import and every animation constant. That is precisely the category of dead code
  listed above, and exactly why none of it was ever flagged. `react/jsx-uses-vars` (`:61`) already
  covered the case it was meant to address, so the pattern was both harmful and redundant.
- `lambda/` was in `globalIgnores` — the production handler went unlinted.
- `ecmaVersion: 2020` (`:51`) contradicted `'latest'` (`:53`).
- `eslint-plugin-react` was registered (`:44`) but its recommended config never extended.
- No `eslint-plugin-jsx-a11y`, despite the repo shipping an a11y instructions file. It would have
  mechanically caught A11Y-04, A11Y-05, and A11Y-11.

**CSS**
- `#ffd700` hardcoded **12 times** in `App.css` despite `--rainbow-yellow` existing; `#ff4500` used
  5 times with no token at all (now `--accent-orange`).
- The focus ring was copy-pasted at `:310, 392, 474, 496, 557` — and had already drifted in colour.
  Now one rule.
- Spacing tokens were used in the top half of the file and abandoned in the cart block (added
  later), which used raw rem values throughout. Two spacing systems in one file.
- `var(--rainbow-cyan, #00ffff)` (`index.css:57`) referenced a token that **did not exist** — every
  link on the site silently used the fallback. Token added.
- `100vh` (`:4, :22`) vs `100dvh` (`:344`) — on mobile Safari the drawer and page disagreed by the
  height of the URL bar.
- `var(--card-bg, #1a0030)` and `var(--text-primary, #fff)` supplied fallbacks for tokens that are
  unconditionally defined — and `#1a0030` did not match `--card-bg`, so if the fallback ever fired
  the drawer changed colour.

**CSS ↔ Framer Motion collisions**
- `.product-card:hover { transform: scale(1.02) }` was **dead** — Framer writes an inline transform
  that beats the stylesheet.
- `.btn-buy:hover { transform: translate(-2px,-2px) }` was a **visible bug**: `whileHover={{ scale:
  1.05 }}` replaced the translate entirely while the matching `box-shadow: 6px 6px` still applied,
  producing a shadow offset corresponding to no displacement — and making "Add to Cart" behave
  differently from the plain-`<button>` checkout and Coming Soon controls.

**Render performance**
- `addToCart` / `updateQuantity` / `clearCart` and the inline arrows at `App.jsx:72, 82` were
  recreated every render. Because `onClose` was a fresh closure, `CartDrawer`'s global keydown
  listener was **removed and re-added on every single App render**. Now `useCallback`.
- `ProductCard` is `memo`ised — each card is a `motion.div` with `whileHover` and a spring-animated
  price badge, so re-rendering the grid on every cart mutation was real work.
- `staggerContainer(0.15)` and `withDelay(...)` were called during render. Framer propagates
  variants **by reference**, so each render handed it a brand-new variant tree. Hoisted to module
  constants; `animations.js` documents why.
- Three `motion.div`s in `Header.jsx` had no motion props at all (their movement is CSS) — now
  plain `<div>`s.
- `withDelay` read `variant.visible.transition` unguarded; passing a stagger container would have
  silently dropped `staggerChildren`. Now throws.

**Documentation**
The repo had **no README, no CLAUDE.md, no AGENTS.md** — zero human-facing documentation. The only
prose describing the project was its git history. `CLAUDE.md` now records the architecture and the
non-negotiables.

---

## Still open

1. **SEC-07 — no webhook verification.** Must be resolved before taking live payments.
2. **CI-07 — CloudFront custom error response.** `/success` 404s in production until 403/404 →
   `/index.html` (200) is configured. The distribution is managed outside this repo.
3. **Rotate the `sk_test_51Tb…` key in `.env.local`** if this host or filesystem image is shared.
   It was never committed.
