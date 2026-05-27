/**
 * AWS Lambda: POST /create-checkout
 *
 * Creates a Stripe Checkout Session from a cart and returns the redirect URL.
 * Deployed behind API Gateway (REST v1 or HTTP API v2 — both formats supported).
 *
 * This is the PRODUCTION equivalent of netlify/functions/create-checkout.js,
 * which is used only for local development via `netlify dev`.
 *
 * Required Lambda environment variables:
 *   STRIPE_SECRET_KEY  — Stripe secret key (set in Lambda config, NEVER in code)
 *   ALLOWED_ORIGIN     — Comma-separated list of allowed CORS origins
 *                        e.g. "https://shop.passion.graphics,https://staging.shop.passion.graphics"
 *
 * Request body:
 *   { cart: [{ priceId: string, quantity: number }] }
 *
 * Response (200):
 *   { url: string }  — Stripe-hosted checkout URL, redirect the user here
 */

import Stripe from 'stripe'

const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/
const MAX_LINE_ITEMS = 20
const MAX_QTY = 99

/**
 * Resolve HTTP method from both API Gateway v1 (REST) and v2 (HTTP API) formats.
 * v1: event.httpMethod
 * v2: event.requestContext.http.method
 */
function getMethod(event) {
  return (event.httpMethod ?? event.requestContext?.http?.method ?? '').toUpperCase()
}

/**
 * Resolve origin header.
 * API Gateway may lowercase headers (v2) or preserve case (v1).
 */
function getOrigin(event) {
  return event.headers?.origin ?? event.headers?.Origin ?? ''
}

/**
 * Build CORS headers restricted to ALLOWED_ORIGIN env var.
 * If the request origin is in the allowlist, echo it back (required for credentialed requests).
 * Falls back to the first allowed origin if not matched.
 */
function corsHeaders(requestOrigin) {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  const matched = allowed.includes(requestOrigin)
  const origin = matched ? requestOrigin : (allowed[0] ?? '*')

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export const handler = async (event) => {
  const method = getMethod(event)
  const requestOrigin = getOrigin(event)
  const cors = corsHeaders(requestOrigin)

  // Handle CORS preflight — API Gateway can also be configured to do this
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }

  if (method !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  // --- Parse body ---
  let cart
  try {
    ;({ cart } = JSON.parse(event.body ?? '{}'))
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  // --- Input validation ---
  // Only priceId + quantity are accepted from the client.
  // Actual prices are enforced by Stripe — the client cannot forge a lower amount.
  if (!Array.isArray(cart) || cart.length === 0) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Cart is empty' }) }
  }
  if (cart.length > MAX_LINE_ITEMS) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: `Cart exceeds ${MAX_LINE_ITEMS} items` }),
    }
  }
  for (const item of cart) {
    if (typeof item.priceId !== 'string' || !PRICE_ID_RE.test(item.priceId)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid price ID format' }) }
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid quantity' }) }
    }
  }

  // --- Create Checkout Session ---
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Use the first allowed origin as the site base URL for redirect URLs
  const allowed = (process.env.ALLOWED_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  const siteOrigin = allowed[0] ?? 'https://shop.passion.graphics'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cart.map(({ priceId, quantity }) => ({
        price: priceId,
        quantity,
        // Allow customers to adjust quantities on the Stripe Checkout page
        adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_QTY },
      })),
      // {CHECKOUT_SESSION_ID} is a Stripe template literal replaced at redirect time
      success_url: `${siteOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/`,
    })

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    // Log full details server-side only — never expose Stripe internals to the client
    console.error('[create-checkout] Stripe error:', err.message)
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    }
  }
}
