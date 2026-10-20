// Local `netlify dev` only: same endpoint as lambda/create-checkout/index.mjs (request shape
// there). Locally set ALLOWED_ORIGIN=http://localhost:8888 in .env.local.

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
