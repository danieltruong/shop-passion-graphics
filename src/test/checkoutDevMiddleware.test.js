import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import { checkoutMiddleware } from '../../vite.config.js'

const ORIGIN = 'http://localhost:5173'

describe('vite dev checkout middleware', () => {
  // Unknown product is decided only after the catalog file is read; a wrong path rejects instead.
  it('reads the bundled catalog and rejects a price that is not in it', async () => {
    const req = Object.assign(
      Readable.from([Buffer.from(JSON.stringify({ cart: [{ priceId: 'price_notInCatalog', quantity: 1 }] }))]),
      { method: 'POST', headers: { origin: ORIGIN } },
    )
    const res = {
      writeHead(status) {
        this.status = status
      },
      end(body) {
        this.body = body
      },
    }

    await checkoutMiddleware(req, res, { ALLOWED_ORIGIN: ORIGIN })

    expect(res.status).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Unknown product' })
  })
})
