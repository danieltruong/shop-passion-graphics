// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import viteConfig, { checkoutMiddleware } from '../../vite.config.js'

const ORIGIN = 'http://localhost:5173'
const ENV = { ALLOWED_ORIGIN: ORIGIN }

function fakeReq(method, chunks = []) {
  return Object.assign(Readable.from(chunks), { method, headers: { origin: ORIGIN } })
}

function fakeRes() {
  return {
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(body) {
      this.body = body
    },
  }
}

// Registers the dev plugin against a stand-in connect server and returns what it mounted.
function mountDevApi() {
  const plugin = viteConfig.plugins.flat().find((p) => p?.name === 'checkout-dev-api')
  const mounted = {}
  plugin.configureServer({
    config: { mode: 'test', envDir: import.meta.dirname },
    middlewares: {
      use(path, handler) {
        Object.assign(mounted, { path, handler })
      },
    },
  })
  return mounted
}

describe('vite dev checkout middleware', () => {
  // Unknown product is decided only after the catalog file is read; a wrong path rejects instead.
  it('reads the bundled catalog and rejects a price that is not in it', async () => {
    const req = fakeReq('POST', [
      Buffer.from(JSON.stringify({ cart: [{ priceId: 'price_notInCatalog', quantity: 1 }] })),
    ])
    const res = fakeRes()

    await checkoutMiddleware(req, res, ENV)

    expect(res.status).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Unknown product' })
  })

  it('answers a non-POST request with 405 and a JSON error body', async () => {
    const res = fakeRes()

    await checkoutMiddleware(fakeReq('GET'), res, ENV)

    expect(res.status).toBe(405)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(res.body)).toEqual({ error: 'Method Not Allowed' })
  })

  it('answers an OPTIONS preflight with 204, the CORS headers and an empty body', async () => {
    const res = fakeRes()

    await checkoutMiddleware(fakeReq('OPTIONS'), res, ENV)

    expect(res.status).toBe(204)
    expect(res.headers).toEqual({
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    })
    expect(res.body).toBe('')
  })

  it('mounts at the path CartDrawer posts to', () => {
    expect(mountDevApi().path).toBe('/api/create-checkout')
  })

  // A body stream that errors (client abort) makes the handler reject; Vite must get it via next.
  it('passes a handler failure to next instead of leaving the promise rejected', async () => {
    const { handler } = mountDevApi()
    const req = Object.assign(
      new Readable({
        read() {
          this.destroy(new Error('client aborted'))
        },
      }),
      { method: 'POST', headers: { origin: ORIGIN } },
    )
    const res = fakeRes()

    const err = await new Promise((resolve) => handler(req, res, resolve))

    expect(err.message).toBe('client aborted')
    expect(res.status).toBeUndefined()
  }, 2000)
})
