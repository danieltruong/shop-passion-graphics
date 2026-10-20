/**
 * Netlify Function: POST /.netlify/functions/create-checkout — LOCAL DEVELOPMENT ONLY.
 *
 * Production runs on AWS Lambda (see lambda/create-checkout/index.mjs); this exists so
 * `netlify dev` can serve the same endpoint locally.
 *
 * Thin adapter over the shared checkout-core.mjs. Netlify's esbuild bundler follows the
 * relative import, so the shared module ships with the function.
 *
 * This handler previously derived success_url / cancel_url from the request's Origin/Host
 * headers, which was an open redirect. Redirect URLs now come from ALLOWED_ORIGIN, exactly
 * as in production. For local use set ALLOWED_ORIGIN=http://localhost:8888 in .env.local.
 *
 * Request body:  { cart: [{ priceId: string, quantity: number }] }
 * Response (200): { url: string }
 * Response (4xx/5xx): { error: string }
 */

import { resolve } from 'node:path'
import { handleCheckout } from '../../lambda/create-checkout/checkout-core.mjs'

// netlify dev bundles this as CJS, where import.meta.url is empty; it runs from the repo
// root, so resolve the catalog in public/ from the working directory instead.
const CATALOG_PATH = resolve(process.cwd(), 'public/products.json')

export const handler = async (event) => {
  const { status, headers, body } = await handleCheckout({
    method: (event.httpMethod ?? '').toUpperCase(),
    origin: event.headers?.origin ?? event.headers?.Origin ?? '',
    body: event.body,
    catalogPath: CATALOG_PATH,
  })

  return {
    statusCode: status,
    headers: body === '' ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === '' ? '' : JSON.stringify(body),
  }
}
