// Only copy of the checkout logic, for index.mjs and the vite.config.js dev middleware; never fork it.
// Lives here because SAM packages only this directory (`CodeUri` in infra/template.yaml).

import Stripe from 'stripe'
import { readFile } from 'node:fs/promises'

/** Stripe Price IDs are "price_" followed by alphanumerics. Format check only — see the catalog check. */
export const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/

// Distinct line items per session. Stripe allows 100; this store never needs that many, and a
// lower cap shrinks the abuse surface.
export const MAX_LINE_ITEMS = 20

/** Upper bound on quantity per line item. Mirrored client-side in src/App.jsx. */
export const MAX_QTY = 99

/** Pin the API version so a Stripe-side default bump can't silently change behaviour. */
const STRIPE_API_VERSION = '2025-10-29.clover'

// Parse ALLOWED_ORIGIN into a list. [] when unset: callers must treat that as misconfiguration,
// never as "allow all".
export function allowedOrigins(env = process.env) {
  return (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

// null when the origin is off the allowlist, which callers must turn into a 403.
// `Vary: Origin` stops a shared cache serving one origin's ACAO to another.
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

// Base URL for success_url / cancel_url. Never from Origin/Host headers: an attacker could mint
// a session that sends the paying customer, and the session id, to any host.
export function siteOrigin(env = process.env) {
  const [first] = allowedOrigins(env)
  if (!first) throw new Error('ALLOWED_ORIGIN is not configured')
  return first
}

// Sellable price IDs, loaded once per container. The `price_` format check alone accepts any
// price in the account: archived, internal discount, or subscription prices.
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

// Returns { status, error } or { lineItems }. Repeated price IDs are merged: Stripe shows
// duplicate `price` entries as separate lines of the same product.
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

// Prod passes only an SSM ARN, keeping the key out of CloudFormation, deploy logs and
// GetFunctionConfiguration. A local STRIPE_SECRET_KEY wins and the SDK never loads.
let secretPromise = null

// A variable, not a literal, so bundlers skip it: the SDK exists only in the Lambda bundle and
// the frontend test run must never load it.
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

// Client built per call so a bad key throws inside the caller's try and keeps CORS headers. No
// idempotency key: keys are account-wide, so a cart hash would hand shoppers each other's session.
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

// Adapters pass { method, origin, body, catalogPath } and map the returned
// { status, headers, body } to their platform's response.
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
