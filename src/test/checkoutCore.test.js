/**
 * Tests for the shared checkout core — the security-critical half of the app.
 *
 * These exercise the pure validation surface (CORS policy, catalog allowlist, cart validation,
 * redirect origin) plus the shape of the call to Stripe, with the SDK stubbed — no live key.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Stubbed so createSession's call to Stripe can be asserted without a live key. This works only
// because vite.config.js aliases 'stripe' to a single copy for the test run — `nmHoistingLimits:
// workspaces` otherwise gives checkout-core.mjs its own, which this mock would not intercept.
const { sessionsCreate, stripeStub } = vi.hoisted(() => {
  const create = vi.fn()
  return {
    sessionsCreate: create,
    stripeStub: () => ({
      default: class {
        checkout = { sessions: { create: (...args) => create(...args) } }
      },
    }),
  }
})
vi.mock('stripe', stripeStub)

import {
  corsHeaders,
  allowedOrigins,
  siteOrigin,
  buildLineItems,
  createSession,
  resetCatalogCache,
  handleCheckout,
  MAX_QTY,
  MAX_LINE_ITEMS,
} from '../../lambda/create-checkout/checkout-core.mjs'

// Resolved from the project root: under jsdom, import.meta.url is an http: URL, not a file: one.
const CATALOG = resolve(process.cwd(), 'public/products.json')
const ORIGIN = 'https://shop.passion.graphics'
const env = { ALLOWED_ORIGIN: `${ORIGIN},https://staging.shop.passion.graphics` }

/** A price ID that really is in public/products.json — the catalog the handler validates against. */
const { products: catalogProducts } = JSON.parse(readFileSync(CATALOG, 'utf8'))
const realPriceId = catalogProducts.find((p) => p.stripePriceId).stripePriceId

beforeEach(() => {
  resetCatalogCache()
})

describe('allowedOrigins', () => {
  it('splits and trims a comma-separated list', () => {
    expect(allowedOrigins({ ALLOWED_ORIGIN: ' a , b ' })).toEqual(['a', 'b'])
  })

  it('is empty when unset — callers must treat that as misconfiguration, not "allow all"', () => {
    expect(allowedOrigins({})).toEqual([])
  })
})

describe('corsHeaders', () => {
  it('echoes an allowed origin', () => {
    expect(corsHeaders(ORIGIN, env)['Access-Control-Allow-Origin']).toBe(ORIGIN)
  })

  it('allows every configured origin, not just the first', () => {
    expect(corsHeaders('https://staging.shop.passion.graphics', env)).not.toBeNull()
  })

  it('returns null for a disallowed origin instead of falling back', () => {
    // The old implementation returned `allowed[0] ?? '*'`, so it never actually rejected.
    expect(corsHeaders('https://evil.tld', env)).toBeNull()
  })

  it('never emits a wildcard when ALLOWED_ORIGIN is unset', () => {
    // An unset CI secret used to ship `Access-Control-Allow-Origin: *` to production.
    expect(corsHeaders('https://evil.tld', {})).toBeNull()
    expect(corsHeaders('', {})).toBeNull()
  })

  it('sets Vary: Origin so a cache cannot cross-serve one origin to another', () => {
    expect(corsHeaders(ORIGIN, env).Vary).toBe('Origin')
  })
})

describe('siteOrigin', () => {
  it('is the first allowed origin — never a request header', () => {
    // Deriving redirect URLs from the client's Origin/Host header was an open redirect.
    expect(siteOrigin(env)).toBe(ORIGIN)
  })

  it('throws rather than guessing when unconfigured', () => {
    expect(() => siteOrigin({})).toThrow(/ALLOWED_ORIGIN/)
  })
})

describe('buildLineItems', () => {
  it('accepts a valid cart', async () => {
    const res = await buildLineItems([{ priceId: realPriceId, quantity: 2 }], CATALOG)
    expect(res.error).toBeUndefined()
    expect(res.lineItems).toEqual([
      {
        price: realPriceId,
        quantity: 2,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_QTY },
      },
    ])
  })

  it('rejects a well-formed price ID that is not in the catalog', async () => {
    // Format validation alone accepted any price in the Stripe account — archived prices,
    // internal discount prices, subscription prices that fail in mode: 'payment'.
    const res = await buildLineItems([{ priceId: 'price_notInCatalog', quantity: 1 }], CATALOG)
    expect(res).toMatchObject({ status: 400, error: 'Unknown product' })
  })

  it('rejects a malformed price ID', async () => {
    for (const priceId of ['prod_123', 'price_', '../etc/passwd', '', null, 123]) {
      const res = await buildLineItems([{ priceId, quantity: 1 }], CATALOG)
      expect(res.status).toBe(400)
    }
  })

  it('rejects an empty or non-array cart', async () => {
    expect((await buildLineItems([], CATALOG)).error).toBe('Cart is empty')
    expect((await buildLineItems(null, CATALOG)).error).toBe('Cart is empty')
    expect((await buildLineItems('nope', CATALOG)).error).toBe('Cart is empty')
  })

  it('rejects too many line items', async () => {
    const cart = Array.from({ length: MAX_LINE_ITEMS + 1 }, () => ({
      priceId: realPriceId,
      quantity: 1,
    }))
    expect((await buildLineItems(cart, CATALOG)).status).toBe(400)
  })

  it('rejects invalid quantities', async () => {
    for (const quantity of [0, -1, 1.5, MAX_QTY + 1, '2', NaN, null]) {
      const res = await buildLineItems([{ priceId: realPriceId, quantity }], CATALOG)
      expect(res.status).toBe(400)
    }
  })

  it('merges duplicate price IDs into one line', async () => {
    // Stripe renders duplicate `price` entries as separate rows for the same product.
    const res = await buildLineItems(
      [
        { priceId: realPriceId, quantity: 2 },
        { priceId: realPriceId, quantity: 3 },
      ],
      CATALOG,
    )
    expect(res.lineItems).toHaveLength(1)
    expect(res.lineItems[0].quantity).toBe(5)
  })

  it('rejects duplicates that together exceed MAX_QTY', async () => {
    const res = await buildLineItems(
      [
        { priceId: realPriceId, quantity: 60 },
        { priceId: realPriceId, quantity: 60 },
      ],
      CATALOG,
    )
    expect(res.status).toBe(400)
  })
})

describe('createSession', () => {
  const lineItems = [{ price: 'price_a', quantity: 1 }]
  const sessionEnv = { ...env, STRIPE_SECRET_KEY: 'sk_test_fake' }

  beforeEach(() => {
    sessionsCreate.mockClear()
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_x' })
  })

  it('sends no idempotency key', async () => {
    // Regression: the key used to be SHA-256 of the line items. Account-scoped keys meant two
    // shoppers with identical carts shared one session, and because the hash omitted the origin,
    // the same cart from a different origin reused a key whose stored parameters had different
    // redirect URLs — which Stripe rejects, breaking checkout for 24 hours.
    await createSession(lineItems, sessionEnv)
    expect(sessionsCreate).toHaveBeenCalledTimes(1)
    expect(sessionsCreate.mock.calls[0]).toHaveLength(1)
  })

  it('builds both redirect URLs from ALLOWED_ORIGIN, never from the request', async () => {
    await createSession(lineItems, sessionEnv)
    const [params] = sessionsCreate.mock.calls[0]
    expect(params.success_url).toBe(`${ORIGIN}/success?session_id={CHECKOUT_SESSION_ID}`)
    expect(params.cancel_url).toBe(`${ORIGIN}/`)
    expect(params.mode).toBe('payment')
  })

  it('sends only price and quantity — never an amount', async () => {
    await createSession(lineItems, sessionEnv)
    const [params] = sessionsCreate.mock.calls[0]
    for (const item of params.line_items) {
      expect(Object.keys(item).sort()).toEqual(['price', 'quantity'])
    }
  })
})

describe('handleCheckout', () => {
  const req = (over = {}) => ({
    method: 'POST',
    origin: ORIGIN,
    body: JSON.stringify({ cart: [{ priceId: realPriceId, quantity: 1 }] }),
    catalogPath: CATALOG,
    ...over,
  })

  it('403s a disallowed origin before touching Stripe', async () => {
    const res = await handleCheckout(req({ origin: 'https://evil.tld' }), env)
    expect(res.status).toBe(403)
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('answers preflight for an allowed origin', async () => {
    const res = await handleCheckout(req({ method: 'OPTIONS' }), env)
    expect(res.status).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ORIGIN)
  })

  it('refuses preflight from a disallowed origin without CORS headers', async () => {
    const res = await handleCheckout(req({ method: 'OPTIONS', origin: 'https://evil.tld' }), env)
    expect(res.status).toBe(403)
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('405s a non-POST method', async () => {
    const res = await handleCheckout(req({ method: 'GET' }), env)
    expect(res.status).toBe(405)
  })

  it('400s malformed JSON — with CORS headers, so the browser sees the real status', async () => {
    const res = await handleCheckout(req({ body: '{oops' }), env)
    expect(res.status).toBe(400)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ORIGIN)
  })

  it('400s an unknown price with CORS headers attached', async () => {
    const res = await handleCheckout(
      req({ body: JSON.stringify({ cart: [{ priceId: 'price_nope', quantity: 1 }] }) }),
      env,
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Unknown product')
    expect(res.headers.Vary).toBe('Origin')
  })

  it('returns a generic 500 without leaking Stripe or config details', async () => {
    // No STRIPE_SECRET_KEY and no ARN — createSession throws. The old code constructed the
    // Stripe client at module scope, producing a 502 with no CORS headers, which the browser
    // then misreported as a CORS failure.
    const res = await handleCheckout(req(), env)
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to create checkout session')
    expect(JSON.stringify(res.body)).not.toMatch(/STRIPE_SECRET|ARN/i)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ORIGIN)
  })
})
