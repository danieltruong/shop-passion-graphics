/**
 * AWS Lambda: POST /create-checkout — PRODUCTION handler.
 *
 * Thin adapter over checkout-core.mjs. All validation, CORS policy, catalog checking, and
 * session creation live there and are shared with the Netlify dev handler. Keep this file
 * limited to event-shape translation.
 *
 * Deployed behind API Gateway; both REST (v1) and HTTP API (v2) event shapes are supported.
 *
 * Environment: STRIPE_SECRET_KEY, ALLOWED_ORIGIN — see checkout-core.mjs.
 *
 * Request body:  { cart: [{ priceId: string, quantity: number }] }
 * Response (200): { url: string } — Stripe-hosted checkout URL
 */

import { fileURLToPath } from 'node:url'
import { handleCheckout } from './checkout-core.mjs'

/**
 * products.json is copied into this directory by `yarn sync:catalog` before `sam build`,
 * so it ships inside the function bundle. Resolved relative to this module rather than cwd,
 * which Lambda does not guarantee.
 */
const CATALOG_PATH = fileURLToPath(new URL('./products.json', import.meta.url))

/** v1 (REST) exposes event.httpMethod; v2 (HTTP API) exposes requestContext.http.method. */
function getMethod(event) {
  return (event.httpMethod ?? event.requestContext?.http?.method ?? '').toUpperCase()
}

/** API Gateway lowercases headers on v2 but preserves case on v1. */
function getOrigin(event) {
  return event.headers?.origin ?? event.headers?.Origin ?? ''
}

export const handler = async (event) => {
  const { status, headers, body } = await handleCheckout({
    method: getMethod(event),
    origin: getOrigin(event),
    body: event.body,
    catalogPath: CATALOG_PATH,
  })

  return {
    statusCode: status,
    headers: body === '' ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === '' ? '' : JSON.stringify(body),
  }
}
