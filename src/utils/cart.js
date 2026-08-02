/**
 * Cart operations — pure functions over the cart array, so they can be tested without
 * mounting React.
 *
 * Cart shape: [{ product: ProductObject, quantity: number }]
 *
 * Lines are keyed on `stripePriceId`, not `productId`. Checkout sends price IDs, so a Stripe
 * product with two prices must be two cart lines; keying on the product would collapse them
 * into one and silently send only one of the prices.
 */

/** Mirrors MAX_QTY in lambda/create-checkout/checkout-core.mjs. */
export const MAX_QTY = 99

/** Mirrors MAX_LINE_ITEMS in lambda/create-checkout/checkout-core.mjs. */
export const MAX_LINE_ITEMS = 20

export const CART_STORAGE_KEY = 'spg.cart.v1'

/** Stable identity for a cart line. */
export function lineKey(product) {
  return product.stripePriceId ?? product.productId
}

/**
 * Add one unit of `product`, incrementing an existing line if present.
 *
 * Returns { cart, error }. Rejections are surfaced rather than thrown so the UI can show them:
 *  - a currency that differs from the rest of the cart (Stripe Checkout accepts a single
 *    currency per session; mixing them also makes the subtotal meaningless)
 *  - more than MAX_LINE_ITEMS distinct lines, or more than MAX_QTY of one line — both of which
 *    the backend rejects, so catching them here avoids an opaque failure at checkout
 */
export function addToCart(cart, product) {
  const key = lineKey(product)
  const existing = cart.find((item) => lineKey(item.product) === key)

  const cartCurrency = cart[0]?.product.currency
  if (cartCurrency && product.currency !== cartCurrency) {
    return {
      cart,
      error: `Your cart is in ${cartCurrency}. Check out first to buy ${product.currency} items.`,
    }
  }

  if (existing) {
    if (existing.quantity >= MAX_QTY) {
      return { cart, error: `Maximum ${MAX_QTY} per item.` }
    }
    return {
      cart: cart.map((item) =>
        lineKey(item.product) === key ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    }
  }

  if (cart.length >= MAX_LINE_ITEMS) {
    return { cart, error: `Cart is limited to ${MAX_LINE_ITEMS} different items.` }
  }

  return { cart: [...cart, { product, quantity: 1 }] }
}

/** Set the quantity of a line. Zero or less removes it; above MAX_QTY clamps. */
export function updateQuantity(cart, key, qty) {
  if (qty <= 0) {
    return cart.filter((item) => lineKey(item.product) !== key)
  }
  const clamped = Math.min(qty, MAX_QTY)
  return cart.map((item) =>
    lineKey(item.product) === key ? { ...item, quantity: clamped } : item,
  )
}

/** Subtotal in minor units. Safe only because addToCart enforces a single currency. */
export function subtotal(cart) {
  return cart.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0)
}

/** Currency of the cart, defaulting to USD when empty. */
export function cartCurrency(cart) {
  return cart[0]?.product.currency ?? 'USD'
}

/** Total unit count across all lines — the cart-icon badge. */
export function totalItems(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Read the persisted cart.
 *
 * Persistence matters because Stripe's cancel_url returns the customer to `/`, which
 * previously wiped everything they had assembled.
 *
 * Stored lines are re-validated against the live catalog: a price archived since the cart was
 * saved would otherwise be rejected at checkout with an unexplained "Unknown product".
 */
export function loadCart(products) {
  let stored
  try {
    stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(stored)) return []

  const byKey = new Map(products.map((p) => [lineKey(p), p]))
  return stored
    .map(({ key, quantity }) => ({ product: byKey.get(key), quantity }))
    // Re-hydrate from the live catalog so prices and names can never go stale.
    .filter(({ product, quantity }) => product && Number.isInteger(quantity) && quantity > 0)
    .map(({ product, quantity }) => ({ product, quantity: Math.min(quantity, MAX_QTY) }))
}

/** Persist the cart as keys + quantities only — never a snapshot of prices. */
export function saveCart(cart) {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart.map(({ product, quantity }) => ({ key: lineKey(product), quantity }))),
    )
  } catch {
    // Private-browsing quota errors must not break the cart.
  }
}
