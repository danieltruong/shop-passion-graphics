/**
 * CartDrawer — slide-in modal panel showing cart contents and the checkout button.
 *
 * Flow:
 *   1. User reviews items + adjusts quantities.
 *   2. User clicks "Checkout via Stripe".
 *   3. We POST the cart (priceId + qty only — never client-side prices) to the checkout
 *      function, which creates a Stripe Checkout Session server-side.
 *   4. We redirect to the Stripe-hosted checkout URL returned by the function.
 *   5. Stripe handles payment, then redirects to /success or / (cancel).
 *
 * Accessibility: this is a real modal dialog. It is unmounted when closed — an always-rendered
 * `aria-modal="true"` panel is announced on every page load and leaves its controls in the tab
 * order off-screen. While open it traps focus; on close App returns focus to the cart button.
 *
 * Props:
 *   cart        [{ product, quantity }]        — current cart items
 *   isOpen      boolean                        — drawer visibility
 *   onClose     () => void                     — close the drawer
 *   onUpdateQty (key: string, qty: number)     — set qty; qty=0 removes the line
 *   onClear     () => void                     — empty the cart
 *   error       string | null                  — cart-level error raised by App
 */
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatPrice } from '../utils/formatPrice'
import { lineKey, subtotal as cartSubtotal, cartCurrency, MAX_QTY } from '../utils/cart'

/**
 * Checkout endpoint:
 *   - Production/staging: VITE_CHECKOUT_API_URL set at build time (API Gateway → Lambda)
 *   - Local dev:          falls back to the Netlify function served by `netlify dev`
 *
 * `||`, not `??`: Vite substitutes a declared-but-empty env var as `""`, which `??` passes
 * through. That produced `fetch("")` — a POST to the current page returning index.html with
 * HTTP 200, so the empty-body guard below never fired and the user saw a raw JSON parse error.
 *
 * VITE_CHECKOUT_API_URL is a *public* URL — not a secret. The secret key lives exclusively in
 * the Lambda/Netlify function environment, never in this bundle.
 */
const CHECKOUT_URL =
  import.meta.env.VITE_CHECKOUT_API_URL || '/.netlify/functions/create-checkout'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onClear, error }) {
  const [loading, setLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const drawerRef = useRef(null)

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (isOpen) drawerRef.current?.focus()
  }, [isOpen])

  // Escape to close, and Tab cycles within the dialog (a11y 2.1.2 / 2.4.3).
  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = drawerRef.current?.querySelectorAll(FOCUSABLE)
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const inside = drawerRef.current.contains(document.activeElement)

      // Wrap at both ends, and pull focus back in if it has escaped the dialog entirely.
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  /** Subtotal in minor units, matching Stripe's unit_amount format. */
  const subtotal = cartSubtotal(cart)
  const currency = cartCurrency(cart)

  /**
   * Creates a Stripe Checkout Session via the serverless function and redirects the browser
   * to Stripe's hosted checkout page.
   *
   * We send only priceId + quantity — never client-provided prices. Actual amounts are
   * authoritative on Stripe's side.
   */
  async function handleCheckout() {
    setLoading(true)
    setCheckoutError(null)
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

      // Guard against an empty body (e.g. a 404 from Vite on :5173 instead of netlify dev on :8888)
      const text = await res.text()
      if (!text) {
        throw new Error(
          res.status === 404
            ? 'Checkout API not found. Make sure you started the app with `npm run dev`.'
            : `Server returned empty response (HTTP ${res.status})`,
        )
      }

      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Checkout API returned an unexpected response. Please try again.')
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed. Please try again.')
      }

      // Only ever navigate to Stripe. A malformed 200 previously sent the browser to the
      // literal string "undefined" — a blank 404 with the cart apparently gone.
      if (typeof data.url !== 'string' || !/^https:\/\/[^/]*\bstripe\.com\//.test(data.url)) {
        throw new Error('Checkout returned an invalid redirect. Please try again.')
      }

      // Navigation begins; deliberately do not clear `loading` afterwards — the document is
      // being torn down and the button should stay disabled until it is.
      window.location.href = data.url
    } catch (err) {
      setCheckoutError(err.message)
      setLoading(false)
    }
  }

  const shownError = checkoutError ?? error

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            className="cart-backdrop"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={drawerRef}
            className="cart-drawer cart-drawer--open"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <div className="cart-drawer-header">
              <h2 className="cart-title rainbow-text">
                <span aria-hidden="true">🛒</span> Your Cart
              </h2>
              <button className="cart-close-btn" onClick={onClose} aria-label="Close cart">
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {/* One status region for the whole dialog. Per-item live regions were created at
                the moment their item was added, so the first change often went unannounced. */}
            <p className="visually-hidden" role="status">
              {cart.length === 0
                ? 'Cart is empty'
                : `Cart has ${cart.length} item${cart.length === 1 ? '' : 's'}, subtotal ${formatPrice(subtotal, currency)}`}
            </p>

            {cart.length === 0 ? (
              <p className="cart-empty">
                Your cart is empty <span aria-hidden="true">✨</span>
              </p>
            ) : (
              <>
                {/*
                  role="list" is redundant per spec but load-bearing in practice: Safari/VoiceOver
                  strips list semantics from a <ul> with list-style: none, which .cart-items sets.
                */}
                {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
                <ul className="cart-items" role="list">
                  {cart.map(({ product, quantity }) => {
                    const key = lineKey(product)
                    return (
                      <li key={key} className="cart-item">
                        {/* Decorative — the product name is the adjacent text. */}
                        <img src={product.imageUrl} alt="" className="cart-item-img" />
                        <div className="cart-item-info">
                          <p className="cart-item-name">{product.name}</p>
                          <p className="cart-item-price">
                            {formatPrice(product.price * quantity, product.currency)}
                            {quantity > 1 && (
                              <span className="cart-item-unit">
                                {' '}
                                ({formatPrice(product.price, product.currency)} each)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="cart-item-controls">
                          <button
                            className="cart-qty-btn"
                            onClick={() => onUpdateQty(key, quantity - 1)}
                            aria-label={`Decrease quantity of ${product.name}`}
                          >
                            <span aria-hidden="true">−</span>
                          </button>
                          <span className="cart-qty">{quantity}</span>
                          <button
                            className="cart-qty-btn"
                            onClick={() => onUpdateQty(key, quantity + 1)}
                            disabled={quantity >= MAX_QTY}
                            aria-label={`Increase quantity of ${product.name}`}
                          >
                            <span aria-hidden="true">+</span>
                          </button>
                          <button
                            className="cart-remove-btn"
                            onClick={() => onUpdateQty(key, 0)}
                            aria-label={`Remove ${product.name} from cart`}
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="cart-footer">
                  <p className="cart-subtotal">
                    Subtotal: <strong>{formatPrice(subtotal, currency)}</strong>
                  </p>

                  {shownError && (
                    <p className="cart-error" role="alert">
                      {shownError}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
