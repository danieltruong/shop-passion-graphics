// Shared product fixtures in the public/products.json shape. Import these; per-file copies drift.

/** Purchasable, badge "new", two images. */
export const frog = {
  productId: 'prod_frog',
  name: 'Frog',
  description: 'I MUST CONSUME',
  price: 10000,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/frog',
  images: ['https://files.stripe.com/links/frog', 'https://files.stripe.com/links/frog-back'],
  slug: 'frog',
  category: 'Prints',
  badge: 'new',
  paymentLink: 'https://buy.stripe.com/test_frog',
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
  images: ['https://files.stripe.com/links/sobble'],
  slug: 'sobble-cart',
  category: 'Stickers',
  badge: null,
  paymentLink: 'https://buy.stripe.com/test_sobble',
  active: true,
  stripeProductId: 'prod_sobble',
  stripePriceId: 'price_sobble',
}

/** Sold out, though it still has a Payment Link, so "no Buy now" checks discriminate. */
export const soldOut = {
  productId: 'prod_sold_out',
  name: 'Old Frog',
  description: 'Gone for now',
  price: 1500,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/old-frog',
  images: ['https://files.stripe.com/links/old-frog'],
  slug: 'old-frog',
  category: 'Stickers',
  badge: 'sold_out',
  paymentLink: 'https://buy.stripe.com/test_old_frog',
  active: true,
  stripeProductId: 'prod_sold_out',
  stripePriceId: 'price_sold_out',
}

/** paymentLink not on buy.stripe.com; normalizeProduct must drop it and warn once. */
export const badLink = {
  productId: 'prod_bad_link',
  name: 'Bad Link',
  description: 'Points off Stripe',
  price: 2500,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/bad-link',
  images: ['https://files.stripe.com/links/bad-link'],
  slug: 'bad-link',
  category: 'Prints',
  badge: null,
  paymentLink: 'https://buy.stripe.com.evil.example/test_bad',
  active: true,
  stripeProductId: 'prod_bad_link',
  stripePriceId: 'price_bad_link',
}

/** No stripePriceId and no paymentLink: renders the disabled "Coming soon" button. */
export const unpriced = {
  productId: 'prod_unpriced',
  name: 'Mystery Item',
  description: 'Not for sale yet',
  price: 500,
  currency: 'CAD',
  imageUrl: 'https://files.stripe.com/links/mystery',
  images: ['https://files.stripe.com/links/mystery'],
  slug: 'mystery-item',
  category: null,
  badge: null,
  paymentLink: null,
  active: true,
  stripeProductId: 'prod_unpriced',
  stripePriceId: null,
}

/** Priced in EUR for the mixed-currency guard. Older catalog shape: no slug, images or link. */
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
