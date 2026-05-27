/**
 * CartIcon — Header button that opens the cart drawer.
 *
 * Displays a shopping cart emoji with a numeric badge showing the total
 * number of items (summed quantities) currently in the cart.
 *
 * Props:
 *   cart    [{ product, quantity }]  — current cart state from App
 *   onClick () => void               — opens CartDrawer
 */
export default function CartIcon({ cart, onClick }) {
  /** Sum all quantities so adding 3 of one item shows "3", not "1". */
  const totalItems = cart.reduce((sum, { quantity }) => sum + quantity, 0)

  return (
    <button
      className="cart-icon-btn"
      onClick={onClick}
      aria-label={`Shopping cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
    >
      🛒
      {totalItems > 0 && (
        <span className="cart-badge" aria-hidden="true">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  )
}
