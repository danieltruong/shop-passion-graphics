/**
 * Netlify serverless function: POST /.netlify/functions/create-checkout
 *
 * Accepts a cart from the frontend, validates it, creates a Stripe Checkout
 * Session (hosted page), and returns the redirect URL.
 *
 * Why server-side? STRIPE_SECRET_KEY must NEVER be exposed to the browser.
 * This function runs in Netlify's Node.js environment where the key is safe.
 *
 * Request body:
 *   { cart: [{ priceId: string, quantity: number }] }
 *
 * Response (200):
 *   { url: string }  — Stripe-hosted checkout URL, redirect the user here
 *
 * Response (4xx/5xx):
 *   { error: string }
 */

import Stripe from 'stripe'

/** Stripe Price IDs always start with "price_" followed by alphanumerics. */
const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/

/** Stripe Checkout supports up to 100 line items in payment mode. */
const MAX_LINE_ITEMS = 20

/** Reasonable upper bound on quantity per item. */
const MAX_QTY = 99

/**
 * Derives the site origin from Netlify event headers.
 * Used to build absolute success_url / cancel_url for the Checkout Session.
 */
function getOrigin(headers) {
  if (headers.origin) return headers.origin
  const proto = headers['x-forwarded-proto'] ?? 'https'
  const host = headers.host ?? 'localhost:8888'
  return `${proto}://${host}`
}

export const handler = async (event) => {
  // Only POST is accepted
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // Parse request body
  let cart
  try {
    ;({ cart } = JSON.parse(event.body ?? '{}'))
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  // --- Input validation ---
  // Never trust the client to send correct prices — we only accept priceId + qty.
  // The actual price amounts are fetched from Stripe by the backend, not the client.
  if (!Array.isArray(cart) || cart.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) }
  }
  if (cart.length > MAX_LINE_ITEMS) {
    return { statusCode: 400, body: JSON.stringify({ error: `Cart exceeds ${MAX_LINE_ITEMS} items` }) }
  }
  for (const item of cart) {
    if (typeof item.priceId !== 'string' || !PRICE_ID_RE.test(item.priceId)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid price ID format' }) }
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid quantity' }) }
    }
  }

  // --- Create Checkout Session ---
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const origin = getOrigin(event.headers)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cart.map(({ priceId, quantity }) => ({
        price: priceId,
        quantity,
        // Let customers adjust quantities on the Stripe Checkout page itself
        adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_QTY },
      })),
      // {CHECKOUT_SESSION_ID} is a Stripe template literal — replaced at redirect time
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    // Log full error server-side, return generic message to client
    console.error('[create-checkout] Stripe error:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    }
  }
}
