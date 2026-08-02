import { describe, it, expect, beforeEach } from 'vitest'
import {
  addToCart,
  updateQuantity,
  subtotal,
  cartCurrency,
  totalItems,
  loadCart,
  saveCart,
  lineKey,
  MAX_QTY,
  MAX_LINE_ITEMS,
  CART_STORAGE_KEY,
} from '../utils/cart'
import { frog, sobble, euroThing, products } from './fixtures'

const line = (product, quantity) => ({ product, quantity })

describe('lineKey', () => {
  it('keys on the price, not the product', () => {
    // Checkout sends price IDs; a product with two prices must be two cart lines.
    expect(lineKey(frog)).toBe('price_frog')
  })

  it('falls back to productId when there is no price', () => {
    expect(lineKey({ productId: 'prod_x' })).toBe('prod_x')
  })
})

describe('addToCart', () => {
  it('adds a new line with quantity 1', () => {
    const { cart, error } = addToCart([], frog)
    expect(error).toBeUndefined()
    expect(cart).toEqual([line(frog, 1)])
  })

  it('increments an existing line instead of duplicating it', () => {
    const { cart } = addToCart([line(frog, 2)], frog)
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(3)
  })

  it('does not mutate the input cart', () => {
    const original = [line(frog, 1)]
    addToCart(original, frog)
    expect(original[0].quantity).toBe(1)
  })

  it('leaves other lines untouched when incrementing', () => {
    const { cart } = addToCart([line(frog, 1), line(sobble, 5)], frog)
    expect(cart.find((i) => i.product === sobble).quantity).toBe(5)
  })

  it('rejects a product in a different currency', () => {
    // Stripe Checkout accepts one currency per session, and a mixed subtotal is meaningless.
    const { cart, error } = addToCart([line(frog, 1)], euroThing)
    expect(error).toMatch(/CAD/)
    expect(cart).toHaveLength(1)
  })

  it('allows a different currency once the cart is empty', () => {
    const { cart, error } = addToCart([], euroThing)
    expect(error).toBeUndefined()
    expect(cart).toHaveLength(1)
  })

  it('refuses to exceed MAX_QTY on one line', () => {
    // The backend rejects >99 with an opaque "Invalid quantity"; catch it here instead.
    const { cart, error } = addToCart([line(frog, MAX_QTY)], frog)
    expect(error).toMatch(/99/)
    expect(cart[0].quantity).toBe(MAX_QTY)
  })

  it('refuses to exceed MAX_LINE_ITEMS distinct lines', () => {
    const full = Array.from({ length: MAX_LINE_ITEMS }, (_, i) =>
      line({ ...frog, productId: `p${i}`, stripePriceId: `price_${i}` }, 1),
    )
    const { cart, error } = addToCart(full, sobble)
    expect(error).toMatch(/20/)
    expect(cart).toHaveLength(MAX_LINE_ITEMS)
  })
})

describe('updateQuantity', () => {
  it('sets the quantity of the matching line', () => {
    const cart = updateQuantity([line(frog, 1), line(sobble, 1)], 'price_frog', 4)
    expect(cart.find((i) => i.product === frog).quantity).toBe(4)
    expect(cart.find((i) => i.product === sobble).quantity).toBe(1)
  })

  it('removes the line at quantity 0', () => {
    const cart = updateQuantity([line(frog, 1), line(sobble, 1)], 'price_frog', 0)
    expect(cart).toHaveLength(1)
    expect(cart[0].product).toBe(sobble)
  })

  it('removes the line at negative quantity', () => {
    expect(updateQuantity([line(frog, 1)], 'price_frog', -3)).toHaveLength(0)
  })

  it('clamps above MAX_QTY rather than sending an invalid cart to the backend', () => {
    const cart = updateQuantity([line(frog, 1)], 'price_frog', 500)
    expect(cart[0].quantity).toBe(MAX_QTY)
  })

  it('is a no-op for an unknown key', () => {
    const cart = updateQuantity([line(frog, 1)], 'price_nope', 9)
    expect(cart).toEqual([line(frog, 1)])
  })
})

describe('subtotal / cartCurrency / totalItems', () => {
  it('multiplies price by quantity in minor units', () => {
    expect(subtotal([line(frog, 2), line(sobble, 3)])).toBe(10000 * 2 + 3499 * 3)
  })

  it('is 0 for an empty cart', () => {
    expect(subtotal([])).toBe(0)
  })

  it('reports the cart currency, defaulting to USD when empty', () => {
    expect(cartCurrency([line(frog, 1)])).toBe('CAD')
    expect(cartCurrency([])).toBe('USD')
  })

  it('sums quantities for the badge', () => {
    expect(totalItems([line(frog, 2), line(sobble, 3)])).toBe(5)
    expect(totalItems([])).toBe(0)
  })
})

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a cart through localStorage', () => {
    saveCart([line(frog, 2), line(sobble, 1)])
    const restored = loadCart(products)
    expect(restored).toHaveLength(2)
    expect(restored[0]).toEqual(line(frog, 2))
  })

  it('stores keys and quantities only, never a price snapshot', () => {
    saveCart([line(frog, 2)])
    const raw = JSON.parse(localStorage.getItem(CART_STORAGE_KEY))
    expect(raw).toEqual([{ key: 'price_frog', quantity: 2 }])
  })

  it('re-hydrates prices from the live catalog', () => {
    saveCart([line(frog, 1)])
    // Same price ID, new amount — the restored line must reflect the catalog, not the storage.
    const restored = loadCart([{ ...frog, price: 12345 }])
    expect(restored[0].product.price).toBe(12345)
  })

  it('drops lines whose product is no longer in the catalog', () => {
    // An archived price would otherwise fail checkout with an unexplained "Unknown product".
    saveCart([line(frog, 1), line(sobble, 1)])
    expect(loadCart([frog])).toHaveLength(1)
  })

  it('returns an empty cart for malformed storage instead of throwing', () => {
    localStorage.setItem(CART_STORAGE_KEY, 'not json')
    expect(loadCart(products)).toEqual([])
  })

  it('ignores non-array stored values', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{"nope":true}')
    expect(loadCart(products)).toEqual([])
  })

  it('rejects non-integer and non-positive quantities', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { key: 'price_frog', quantity: 0 },
        { key: 'price_sobble', quantity: 1.5 },
      ]),
    )
    expect(loadCart(products)).toEqual([])
  })

  it('clamps a tampered quantity to MAX_QTY', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ key: 'price_frog', quantity: 9999 }]))
    expect(loadCart(products)[0].quantity).toBe(MAX_QTY)
  })

  it('returns an empty cart when nothing is stored', () => {
    expect(loadCart(products)).toEqual([])
  })
})
