/**
 * CartDrawer — Slide-in side panel showing cart contents and checkout button.
 *
 * Flow:
 *   1. User reviews items + adjusts quantities.
 *   2. User clicks "Checkout via Stripe".
 *   3. We POST cart (priceId + qty only — never client-side prices) to the
 *      Netlify function, which creates a Stripe Checkout Session server-side.
 *   4. We redirect to the Stripe-hosted checkout URL returned by the function.
 *   5. Stripe handles payment, then redirects to /success or / (cancel).
 *
 * Props:
 *   cart        [{ product, quantity }]            — current cart items
 *   isOpen      boolean                            — drawer visibility
 *   onClose     () => void                         — close the drawer
 *   onUpdateQty (productId: string, qty: number)   — set qty; qty=0 removes item
 *   onClear     () => void                         — empty the cart
 */
import { useState, useEffect, useRef } from 'react'

/**
 * Checkout endpoint:
 *   - Production/staging: VITE_CHECKOUT_API_URL set at build time (API Gateway → Lambda)
 *   - Local dev:          falls back to Netlify function served by `netlify dev`
 *
 * VITE_CHECKOUT_API_URL is a *public* URL — not a secret. The secret key lives
 * exclusively in the Lambda/Netlify function environment, never in this bundle.
 */
const CHECKOUT_URL =
  import.meta.env.VITE_CHECKOUT_API_URL ?? '/.netlify/functions/create-checkout'

export default function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onClear }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Focus the drawer when it opens (a11y: 2.4.3 Focus Order)
  const drawerRef = useRef(null)
  useEffect(() => {
    if (isOpen) drawerRef.current?.focus()
  }, [isOpen])

  // Close on Escape key (a11y: 2.1.2 No Keyboard Trap)
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  /** Subtotal in cents, matching Stripe's unit_amount format. */
  const subtotal = cart.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0)
  const currency = cart[0]?.product.currency ?? 'USD'

  /**
   * Creates a Stripe Checkout Session via the serverless function and
   * redirects the browser to Stripe's hosted checkout page.
   *
   * We send only priceId + quantity — never client-provided prices.
   * Actual amounts are authoritative on Stripe's side.
   */
  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart.map(({ product, quantity }) => ({
            priceId: product.stripePriceId,
            quantity,
          })),
        }),
      })

      // Guard against empty body (e.g. Vite 404 on port 5173 instead of netlify dev on 8888)
      const text = await res.text()
      if (!text) {
        throw new Error(
          res.status === 404
            ? 'Checkout API not found. Make sure you started the app with `npm run dev`.'
            : `Server returned empty response (HTTP ${res.status})`
        )
      }
      const data = JSON.parse(text)

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed. Please try again.')
      }

      // Redirect to Stripe-hosted checkout page
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop — click to close */}
      {isOpen && (
        <div
          className="cart-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`cart-drawer${isOpen ? ' cart-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        tabIndex={-1}
      >
        <div className="cart-drawer-header">
          <h2 className="cart-title rainbow-text">🛒 Your Cart</h2>
          <button
            className="cart-close-btn"
            onClick={onClose}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {cart.length === 0 ? (
          <p className="cart-empty">Your cart is empty ✨</p>
        ) : (
          <>
            <ul className="cart-items" role="list">
              {cart.map(({ product, quantity }) => (
                <li key={product.productId} className="cart-item">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="cart-item-img"
                  />
                  <div className="cart-item-info">
                    <p className="cart-item-name">{product.name}</p>
                    <p className="cart-item-price">
                      {product.currency} ${(product.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      className="cart-qty-btn"
                      onClick={() => onUpdateQty(product.productId, quantity - 1)}
                      aria-label={`Decrease quantity of ${product.name}`}
                    >
                      −
                    </button>
                    <span
                      className="cart-qty"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {quantity}
                    </span>
                    <button
                      className="cart-qty-btn"
                      onClick={() => onUpdateQty(product.productId, quantity + 1)}
                      aria-label={`Increase quantity of ${product.name}`}
                    >
                      +
                    </button>
                    <button
                      className="cart-remove-btn"
                      onClick={() => onUpdateQty(product.productId, 0)}
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-footer">
              <p className="cart-subtotal">
                Subtotal:{' '}
                <strong>
                  {currency} ${(subtotal / 100).toFixed(2)}
                </strong>
              </p>

              {/* Error announced to screen readers via role="alert" */}
              {error && (
                <p className="cart-error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="btn-buy cart-checkout-btn"
                onClick={handleCheckout}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? '⏳ Creating checkout…' : '💳 Checkout via Stripe'}
              </button>

              <button className="cart-clear-btn" onClick={onClear}>
                Clear cart
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
