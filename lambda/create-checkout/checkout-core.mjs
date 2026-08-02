/**
 * Shared checkout logic — the single source of truth for creating Stripe Checkout Sessions.
 *
 * Consumed by two thin, runtime-specific adapters:
 *   - lambda/create-checkout/index.mjs         (production, API Gateway v1/v2)
 *   - netlify/functions/create-checkout.js     (local `netlify dev` only)
 *
 * This file lives inside lambda/create-checkout/ deliberately: infra/template.yaml sets
 * `CodeUri: ../lambda/create-checkout/`, and SAM packages only that directory. The Netlify
 * function imports it by relative path; Netlify's esbuild bundler follows the import.
 *
 * Do NOT fork this logic back into the adapters. The two handlers previously held duplicate
 * copies, and an open-redirect fix landed in only one of them.
 *
 * Environment:
 *   ALLOWED_ORIGIN     — Comma-separated origin allowlist, e.g.
 *                        "https://shop.passion.graphics,https://staging.shop.passion.graphics"
 *                        Required. There is no wildcard fallback.
 *   STRIPE_SECRET_ARN  — Production. SSM SecureString parameter holding the Stripe key,
 *                        fetched at cold start so the key is never a plaintext Lambda env var.
 *   STRIPE_SECRET_KEY  — Local development only (.env.local). Takes precedence when set.
 */

import Stripe from 'stripe'
import { readFile } from 'node:fs/promises'

/** Stripe Price IDs are "price_" followed by alphanumerics. Format check only — see the catalog check. */
export const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/

/**
 * Maximum distinct line items per session. Stripe's own ceiling is 100; we cap lower because
 * this storefront has no legitimate use for more, and a lower cap shrinks the abuse surface.
 */
export const MAX_LINE_ITEMS = 20

/** Upper bound on quantity per line item. Mirrored client-side in src/App.jsx. */
export const MAX_QTY = 99

/** Pin the API version so a Stripe-side default bump can't silently change behaviour. */
const STRIPE_API_VERSION = '2025-10-29.clover'

/**
 * Parse ALLOWED_ORIGIN into a list.
 * Returns [] when unset — callers must treat that as a misconfiguration, not as "allow all".
 */
export function allowedOrigins(env = process.env) {
  return (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

/**
 * Build CORS headers for a request origin.
 *
 * Returns `null` when the origin is not on the allowlist, which callers must turn into a 403.
 * The previous implementation fell back to `allowed[0] ?? '*'`, which meant it never actually
 * rejected anything — it only chose a header value, and an unset ALLOWED_ORIGIN shipped `*`.
 *
 * `Vary: Origin` is required so a shared cache can't serve one origin's ACAO to another.
 */
export function corsHeaders(requestOrigin, env = process.env) {
  const allowed = allowedOrigins(env)
  if (!allowed.includes(requestOrigin)) return null

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/**
 * The site's own base URL, used to build success_url / cancel_url.
 *
 * Always the first allowed origin — NEVER the request's Origin/Host headers. Deriving redirect
 * URLs from client-controlled headers lets an attacker mint a Checkout Session that sends the
 * paying customer to an arbitrary host, taking the session id with it.
 */
export function siteOrigin(env = process.env) {
  const [first] = allowedOrigins(env)
  if (!first) throw new Error('ALLOWED_ORIGIN is not configured')
  return first
}

/**
 * Catalog of sellable price IDs, loaded once per container from the bundled products.json.
 *
 * Format-validating `price_…` is not enough on its own: it accepts *any* price in the Stripe
 * account, including archived prices, internal discount prices, and subscription prices that
 * would fail in `mode: 'payment'`.
 */
let catalogPromise = null

export async function loadCatalog(catalogPath) {
  const raw = await readFile(catalogPath, 'utf8')
  const { products } = JSON.parse(raw)
  return new Set(
    (products ?? [])
      .filter((p) => p.active !== false && typeof p.stripePriceId === 'string')
      .map((p) => p.stripePriceId),
  )
}

function getCatalog(catalogPath) {
  catalogPromise ??= loadCatalog(catalogPath)
  return catalogPromise
}

/** Test seam — resets the memoized catalog. */
export function resetCatalogCache() {
  catalogPromise = null
}

/**
 * Validate a client cart and collapse it into Stripe line items.
 *
 * Returns { error, status } on rejection, or { lineItems } on success.
 * Repeated price IDs are merged rather than rejected — Stripe treats duplicate `price` entries
 * as separate lines, which double-renders the same product on the Checkout page.
 */
export async function buildLineItems(cart, catalogPath) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { status: 400, error: 'Cart is empty' }
  }
  if (cart.length > MAX_LINE_ITEMS) {
    return { status: 400, error: `Cart exceeds ${MAX_LINE_ITEMS} items` }
  }

  const quantities = new Map()
  for (const item of cart) {
    if (typeof item?.priceId !== 'string' || !PRICE_ID_RE.test(item.priceId)) {
      return { status: 400, error: 'Invalid price ID format' }
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY) {
      return { status: 400, error: 'Invalid quantity' }
    }
    const merged = (quantities.get(item.priceId) ?? 0) + item.quantity
    if (merged > MAX_QTY) {
      return { status: 400, error: 'Invalid quantity' }
    }
    quantities.set(item.priceId, merged)
  }

  const catalog = await getCatalog(catalogPath)
  for (const priceId of quantities.keys()) {
    if (!catalog.has(priceId)) {
      return { status: 400, error: 'Unknown product' }
    }
  }

  return {
    lineItems: [...quantities].map(([price, quantity]) => ({
      price,
      quantity,
      // Let customers adjust quantities on the Stripe Checkout page itself
      adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_QTY },
    })),
  }
}

/**
 * Resolve the Stripe secret key, memoized per container.
 *
 * In production the key lives in an SSM SecureString and only its ARN reaches the function, so
 * it never appears in CloudFormation parameters, deploy logs, or `GetFunctionConfiguration`.
 * Locally, STRIPE_SECRET_KEY from .env.local wins and the SDK is never loaded.
 */
let secretPromise = null

/**
 * Held in a variable rather than written as a literal so bundlers don't try to statically
 * resolve it. The SDK is a dependency of this directory's package.json and exists only in the
 * Lambda bundle — the frontend test run must never attempt to load it.
 */
const SSM_MODULE = '@aws-sdk/client-ssm'

async function resolveSecret(env) {
  if (env.STRIPE_SECRET_KEY) return env.STRIPE_SECRET_KEY
  if (!env.STRIPE_SECRET_ARN) {
    throw new Error('Neither STRIPE_SECRET_KEY nor STRIPE_SECRET_ARN is configured')
  }
  secretPromise ??= (async () => {
    const { SSMClient, GetParameterCommand } = await import(/* @vite-ignore */ SSM_MODULE)
    const ssm = new SSMClient({})
    const res = await ssm.send(
      new GetParameterCommand({ Name: env.STRIPE_SECRET_ARN, WithDecryption: true }),
    )
    const value = res.Parameter?.Value
    if (!value) throw new Error('STRIPE_SECRET_ARN resolved to an empty value')
    return value
  })()
  return secretPromise
}

/** Test seam — resets the memoized secret. */
export function resetSecretCache() {
  secretPromise = null
}

/**
 * Create a Checkout Session from an already-validated cart.
 *
 * The Stripe client is constructed here, inside the caller's try block, rather than at module
 * scope: a missing or malformed key throws synchronously, and at module scope that surfaced as a
 * 502 with no CORS headers — which the browser then reported as a misleading CORS error.
 *
 * Deliberately sends NO idempotency key. It previously sent SHA-256 of the cart's line items,
 * which was wrong in two ways. Idempotency keys are scoped to the Stripe account, so two
 * different shoppers with the same cart within the 24h window received the *same* session — the
 * second one landing on a stranger's checkout, unable to pay once the first had. And because the
 * key covered only the line items, the same cart from a different origin reused a key whose
 * stored parameters had different success_url/cancel_url, which Stripe rejects outright:
 *   "Keys for idempotent requests can only be used with the same parameters"
 * That is not hypothetical — carts exercised locally against this sandbox broke the first live
 * staging deploy for 24 hours.
 *
 * A key must identify one logical request; a cart hash identifies a cart, which many shoppers
 * share. The double-submit case it was meant to cover is already handled in CartDrawer, which
 * disables the button while the request is in flight and leaves it disabled through navigation.
 * Surplus unpaid sessions are harmless — they simply expire.
 */
export async function createSession(lineItems, env = process.env) {
  const stripe = new Stripe(await resolveSecret(env), { apiVersion: STRIPE_API_VERSION })
  const origin = siteOrigin(env)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    // {CHECKOUT_SESSION_ID} is a Stripe template literal — replaced at redirect time
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
  })

  return session.url
}

/**
 * Runtime-agnostic request handler.
 *
 * Adapters normalize their platform's event into { method, origin, body } and pass a
 * catalogPath, then translate the returned { status, headers, body } back into their
 * platform's response shape.
 */
export async function handleCheckout({ method, origin, body, catalogPath }, env = process.env) {
  const cors = corsHeaders(origin, env)

  // Preflight is answered even for disallowed origins — without ACAO, so the browser blocks it.
  if (method === 'OPTIONS') {
    return { status: cors ? 204 : 403, headers: cors ?? {}, body: '' }
  }
  if (!cors) {
    return { status: 403, headers: {}, body: { error: 'Origin not allowed' } }
  }
  if (method !== 'POST') {
    return { status: 405, headers: cors, body: { error: 'Method Not Allowed' } }
  }

  let cart
  try {
    ;({ cart } = JSON.parse(body || '{}'))
  } catch {
    return { status: 400, headers: cors, body: { error: 'Invalid JSON body' } }
  }

  const result = await buildLineItems(cart, catalogPath)
  if (result.error) {
    return { status: result.status, headers: cors, body: { error: result.error } }
  }

  try {
    const url = await createSession(result.lineItems, env)
    return { status: 200, headers: cors, body: { url } }
  } catch (err) {
    // Log server-side only — never expose Stripe internals or config details to the client
    console.error('[create-checkout] Stripe error:', err.message)
    return { status: 500, headers: cors, body: { error: 'Failed to create checkout session' } }
  }
}
