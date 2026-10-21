import * as cartOps from './cart'

export const initialCart = { cart: [], cartError: null, cartOpen: false, cartPulse: 0, cartAnnouncement: null }

export function cartReducer(state, action) {
  // Only a successful add speaks here: a rejection's alert and the open drawer's status region
  // cover the rest, and clearing lets an identical message be announced again.
  const base = { ...state, cartAnnouncement: null }
  switch (action.type) {
    case 'add': {
      const { cart, error } = cartOps.addToCart(state.cart, action.product)
      // Success shows on the button and header count; only a rejection opens the drawer's alert.
      if (error) return { ...base, cart, cartError: error, cartOpen: true }
      const count = cartOps.itemsLabel(cartOps.totalItems(cart))
      return {
        ...base,
        cart,
        cartError: null,
        cartPulse: state.cartPulse + 1,
        cartAnnouncement: `Added ${action.product.name} to cart. Cart has ${count}.`,
      }
    }
    case 'updateQty':
      return { ...base, cart: cartOps.updateQuantity(state.cart, action.key, action.qty), cartError: null }
    case 'clear':
      return { ...base, cart: [], cartError: null }
    case 'load':
      return { ...base, cart: action.cart }
    case 'open':
      return { ...base, cartOpen: true }
    case 'close':
      return { ...base, cartOpen: false, cartError: null }
    default:
      throw new Error(`Unknown cart action: ${action.type}`)
  }
}
