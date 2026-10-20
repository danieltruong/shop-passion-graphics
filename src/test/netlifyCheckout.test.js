import { describe, it, expect, afterEach, vi } from 'vitest'
import { handler } from '../../netlify/functions/create-checkout.js'

const ORIGIN = 'http://localhost:8888'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('netlify create-checkout adapter', () => {
  // Unknown product is decided only after the catalog file is read; a wrong path rejects instead.
  it('reads the bundled catalog and rejects a price that is not in it', async () => {
    vi.stubEnv('ALLOWED_ORIGIN', ORIGIN)

    const res = await handler({
      httpMethod: 'POST',
      headers: { origin: ORIGIN },
      body: JSON.stringify({ cart: [{ priceId: 'price_notInCatalog', quantity: 1 }] }),
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Unknown product' })
  })
})
