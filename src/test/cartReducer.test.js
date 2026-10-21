import { describe, it, expect } from 'vitest'
import { cartReducer, initialCart } from '../utils/cartReducer'
import { euroThing, frog, sobble } from './fixtures'

const withFrog = { ...initialCart, cart: [{ product: frog, quantity: 1 }] }

describe('cartReducer', () => {
  describe('a successful add', () => {
    it('leaves the drawer closed', () => {
      expect(cartReducer(initialCart, { type: 'add', product: frog }).cartOpen).toBe(false)
    })

    it('bumps the pulse once', () => {
      expect(cartReducer({ ...initialCart, cartPulse: 4 }, { type: 'add', product: frog }).cartPulse).toBe(5)
    })

    it('announces the product and the new unit count', () => {
      const state = cartReducer(withFrog, { type: 'add', product: frog })
      expect(state.cartAnnouncement).toBe('Added Frog to cart. Cart has 2 items.')
    })

    it('clears an earlier error', () => {
      const state = cartReducer({ ...withFrog, cartError: 'old' }, { type: 'add', product: sobble })
      expect(state.cartError).toBeNull()
    })
  })

  describe('a rejected add', () => {
    const announced = { ...withFrog, cartPulse: 4, cartAnnouncement: 'Added Frog to cart. Cart has 1 item.' }
    const rejected = () => cartReducer(announced, { type: 'add', product: euroThing })

    it('opens the drawer with the reason', () => {
      expect(rejected().cartOpen).toBe(true)
      expect(rejected().cartError).toBe('Your cart is in CAD. Check out first to buy EUR items.')
    })

    it('keeps the cart, the pulse and silence', () => {
      expect(rejected().cart).toEqual([{ product: frog, quantity: 1 }])
      expect(rejected().cartPulse).toBe(4)
      expect(rejected().cartAnnouncement).toBeNull()
    })
  })

  it.each([
    ['open', {}],
    ['close', {}],
    ['clear', {}],
    ['updateQty', { key: 'price_frog', qty: 3 }],
    ['load', { cart: [] }],
  ])('%s clears the announcement', (type, extra) => {
    const announced = { ...withFrog, cartAnnouncement: 'Added Frog to cart. Cart has 1 item.' }
    expect(cartReducer(announced, { type, ...extra }).cartAnnouncement).toBeNull()
  })

  it('close clears the error so the next open starts clean', () => {
    const state = cartReducer({ ...withFrog, cartOpen: true, cartError: 'Maximum 99 per item.' }, { type: 'close' })
    expect(state.cartOpen).toBe(false)
    expect(state.cartError).toBeNull()
  })

  it('load restores lines without bumping the pulse', () => {
    const state = cartReducer(initialCart, { type: 'load', cart: [{ product: sobble, quantity: 2 }] })
    expect(state.cart).toEqual([{ product: sobble, quantity: 2 }])
    expect(state.cartPulse).toBe(0)
  })

  it('rejects an unknown action', () => {
    expect(() => cartReducer(initialCart, { type: 'nope' })).toThrow('Unknown cart action: nope')
  })
})
