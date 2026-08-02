/**
 * Shared product fixtures.
 *
 * Previously each test file defined its own, and they drifted: App.test.jsx's fixture had a
 * `paymentLink` but no `stripePriceId`, so it rendered the *disabled* "Coming Soon" button.
 * That made the "renders coming soon when fetch fails" test non-discriminating — the success
 * path matched `/coming soon/i` too.
 */

/** A normal, purchasable product. Mirrors the real public/products.json shape. */
export const frog = {
  productId: 'prod_frog',
  name: 'Frog',
  description: 'I MUST CONSUME',
  price: 10000,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/frog',
  active: true,
  stripeProductId: 'prod_frog',
  stripePriceId: 'price_frog',
}

export const sobble = {
  productId: 'prod_sobble',
  name: 'Sobble Cart',
  description: 'RELEASE ME FROM MY PRISON!',
  price: 3499,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/sobble',
  active: true,
  stripeProductId: 'prod_sobble',
  stripePriceId: 'price_sobble',
}

/** No stripePriceId — renders the disabled "Coming Soon" button. */
export const unpriced = {
  productId: 'prod_unpriced',
  name: 'Mystery Item',
  description: 'Not for sale yet',
  price: 500,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/mystery',
  active: true,
  stripeProductId: 'prod_unpriced',
  stripePriceId: null,
}

/** Priced in a different currency — used to exercise the mixed-currency guard. */
export const euroThing = {
  productId: 'prod_euro',
  name: 'Euro Thing',
  description: 'Priced in EUR',
  price: 2000,
  currency: 'EUR',
  imageUrl: 'https://files.stripe.com/links/euro',
  active: true,
  stripeProductId: 'prod_euro',
  stripePriceId: 'price_euro',
}

export const products = [frog, sobble]

/** Mock a successful /products.json fetch. */
export function mockProductsFetch(list = products) {
  return { ok: true, status: 200, json: async () => ({ products: list }) }
}
