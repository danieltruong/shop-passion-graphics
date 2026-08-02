import { totalItems as sumItems } from '../utils/cart'

/**
 * CartIcon — Header button that opens the cart drawer.
 *
 * Displays a shopping cart emoji with a numeric badge showing the total number of items
 * (summed quantities) currently in the cart.
 *
 * Props:
 *   cart    [{ product, quantity }]  — current cart state from App
 *   onClick (event) => void          — opens CartDrawer; the event lets App capture this
 *                                      button as the focus-restore target
 */
export default function CartIcon({ cart, onClick }) {
  const totalItems = sumItems(cart)

  return (
    <button
      className="cart-icon-btn"
      onClick={onClick}
      aria-label={`Shopping cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
    >
      <span aria-hidden="true">🛒</span>
      {totalItems > 0 && (
        <span className="cart-badge" aria-hidden="true">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  )
}
