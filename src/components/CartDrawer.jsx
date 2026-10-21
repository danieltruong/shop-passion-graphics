// Unmounted when closed: an always-rendered aria-modal panel is announced on every page load
// and leaves its controls in the tab order off-screen.
import { useState, useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Button from './Button'
import { IconClose, IconFrog, IconLock, IconMinus, IconPlus, IconTrash, IconWarning } from './icons'
import { placeholders, policies } from '../content/site'
import { formatPrice } from '../utils/formatPrice'
import { lineKey, subtotal as cartSubtotal, cartCurrency, totalItems, itemsLabel, MAX_QTY } from '../utils/cart'
import './Window.css'
import './CartDrawer.css'

// Unset locally, so dev hits the Vite checkout middleware. `||`, not `??`: Vite turns a
// declared-but-empty env var into "", and fetch("") would POST to the page itself.
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_API_URL || '/api/create-checkout'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

const SHIPPING_BLOCKS = 20
const BLOCK_STEP = 0.03

// Blocks change one at a time, starting next to the previous fill level.
function FreeShippingBar({ subtotal, currency }) {
  const reduceMotion = useReducedMotion()
  const threshold = policies.freeShippingThresholdCents
  const active = typeof threshold === 'number' && threshold > 0 && currency.toLowerCase() === 'cad'
  const filled = active ? Math.min(SHIPPING_BLOCKS, Math.floor((subtotal / threshold) * SHIPPING_BLOCKS)) : 0

  const [from, setFrom] = useState(0)
  const [shown, setShown] = useState(filled)
  if (shown !== filled) {
    setFrom(shown)
    setShown(filled)
  }

  if (!active) {
    return (
      <p className="cart-shipping__text">
        Free shipping in Canada over {placeholders.freeShippingThreshold}.
      </p>
    )
  }

  const remaining = threshold - subtotal
  // One sentence for the visible text and the progress bar's value text; the middle part is bold.
  const [lead, strong, tail] =
    remaining > 0
      ? ['', formatPrice(remaining, currency), ' away from free shipping in Canada']
      : ['You get ', 'free shipping', ' in Canada']
  const delay = (i) => (reduceMotion ? 0 : Math.max(0, filled > from ? i - from : from - 1 - i) * BLOCK_STEP)

  return (
    <div className="cart-shipping">
      <p className="cart-shipping__text">
        {lead}
        <strong>{strong}</strong>
        {tail}
      </p>
      <div
        className="cart-shipping__bar sunken"
        style={{ '--shipping-blocks': SHIPPING_BLOCKS }}
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round((subtotal / threshold) * 100))}
        aria-valuetext={lead + strong + tail}
      >
        {Array.from({ length: SHIPPING_BLOCKS }, (_, i) => (
          <motion.span
            key={i}
            className="cart-shipping__block"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: i < filled ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.04, delay: delay(i) }}
          />
        ))}
      </div>
    </div>
  )
}

export default function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onClear, error }) {
  const [loading, setLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  if (!isOpen && checkoutError) setCheckoutError(null)
  const drawerRef = useRef(null)
  const titleId = useId()
  const reduceMotion = useReducedMotion()

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (isOpen) drawerRef.current?.focus()
  }, [isOpen])

  // Back from Stripe through the bfcache restores the page with the checkout button still busy.
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

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
  const itemCount = totalItems(cart)

  // The removed line takes the focused button with it: focus the next line's first control,
  // else the previous line's, else the dialog (a11y 2.4.3).
  function removeLine(index) {
    const neighbour = cart[index + 1] ?? cart[index - 1]
    onUpdateQty(lineKey(cart[index].product), 0)
    const row =
      neighbour && drawerRef.current.querySelector(`[data-line-key="${CSS.escape(lineKey(neighbour.product))}"]`)
    ;(row?.querySelector(FOCUSABLE) ?? drawerRef.current)?.focus()
  }

  // Sends only priceId + quantity, never prices: amounts come from Stripe, not the client.
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

      // Empty body, e.g. the 404 from `vite preview`, which has no checkout middleware
      const text = await res.text()
      if (!text) {
        throw new Error(
          res.status === 404
            ? 'Checkout API not found. Make sure you started the app with `yarn dev`.'
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

      // Only ever navigate to Stripe; a malformed 200 would otherwise load the URL "undefined".
      if (typeof data.url !== 'string' || !/^https:\/\/[^/]*\bstripe\.com\//.test(data.url)) {
        throw new Error('Checkout returned an invalid redirect. Please try again.')
      }

      // Keep `loading` set: the button must stay disabled while the page unloads.
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
          <motion.div
            className="cart-backdrop"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.2, ease: 'easeIn' } }}
          />

          <motion.div
            ref={drawerRef}
            className="cart-drawer window bevel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
          >
            <div className="window__titlebar">
              <h2 className="window__title" id={titleId}>
                Your cart{itemCount > 0 && ` (${itemsLabel(itemCount)})`}
              </h2>
              <Button variant="win" className="cart-drawer__close" onClick={onClose} aria-label="Close cart">
                <IconClose />
              </Button>
            </div>

            {/* One status region for the whole dialog: a per-item live region created with its
                item misses that item's first change. */}
            <p className="visually-hidden" role="status">
              {cart.length === 0
                ? 'Cart is empty'
                : `Cart has ${itemsLabel(itemCount)}, subtotal ${formatPrice(subtotal, currency)}`}
            </p>

            {cart.length === 0 ? (
              <div className="cart-empty sunken">
                <IconFrog size={96} />
                <h3 className="cart-empty__title">Your cart is empty</h3>
                <p className="cart-empty__text">Find something you like and it&apos;ll show up here.</p>
                <Button size="lg" onClick={onClose}>
                  Keep shopping
                </Button>
              </div>
            ) : (
              <div className="cart-drawer__body">
                <FreeShippingBar subtotal={subtotal} currency={currency} />

                {/* role="list" is redundant per spec, but Safari/VoiceOver strips list semantics
                    from a <ul> with list-style: none, which .cart-items sets. */}
                <motion.ul className="cart-items" role="list" layoutScroll>
                  <AnimatePresence initial={false} mode="popLayout">
                    {cart.map(({ product, quantity }, index) => {
                      const key = lineKey(product)
                      return (
                        <motion.li
                          key={key}
                          data-line-key={key}
                          className="cart-item sunken"
                          layout
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                        >
                          {/* Decorative — the product name is the adjacent text. */}
                          <img src={product.imageUrl} alt="" className="cart-item-img" />
                          <div className="cart-item-info">
                            <div className="cart-item-head">
                              <p className="cart-item-name">{product.name}</p>
                              <p className="cart-item-price">
                                {formatPrice(product.price * quantity, product.currency)}
                              </p>
                            </div>
                            {quantity > 1 && (
                              <p className="cart-item-unit">
                                {formatPrice(product.price, product.currency)} each
                              </p>
                            )}
                            <div className="cart-item-controls">
                              <div className="cart-qty">
                                <Button
                                  variant="win"
                                  className="cart-qty__btn"
                                  onClick={() => (quantity > 1 ? onUpdateQty(key, quantity - 1) : removeLine(index))}
                                  aria-label={`Decrease quantity of ${product.name}`}
                                >
                                  <IconMinus />
                                </Button>
                                <span className="cart-qty__value">{quantity}</span>
                                <Button
                                  variant="win"
                                  className="cart-qty__btn"
                                  onClick={() => onUpdateQty(key, quantity + 1)}
                                  disabled={quantity >= MAX_QTY}
                                  aria-label={`Increase quantity of ${product.name}`}
                                >
                                  <IconPlus />
                                </Button>
                              </div>
                              <button
                                type="button"
                                className="cart-link-btn"
                                onClick={() => removeLine(index)}
                                aria-label={`Remove ${product.name} from cart`}
                              >
                                <IconTrash />
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </motion.ul>

                <div className="cart-footer">
                  <p className="cart-subtotal">
                    <span>Subtotal</span>
                    <strong>{formatPrice(subtotal, currency)}</strong>
                  </p>
                  <p className="cart-footer__line">
                    <span>Shipping &amp; taxes</span>
                    <span>Calculated at checkout</span>
                  </p>

                  {shownError && (
                    <p className="cart-error sunken" role="alert">
                      <IconWarning />
                      <span>{shownError}</span>
                    </p>
                  )}

                  <Button
                    size="xl"
                    className="cart-checkout"
                    onClick={handleCheckout}
                    disabled={loading}
                    aria-busy={loading}
                  >
                    {loading ? (
                      'Creating checkout…'
                    ) : (
                      <>
                        <IconLock size={20} />
                        Checkout via Stripe
                      </>
                    )}
                  </Button>
                  <p className="cart-footer__note">You&apos;ll finish paying on Stripe&apos;s secure page.</p>

                  <div className="cart-footer__actions">
                    <Button variant="win" onClick={onClose}>
                      Keep shopping
                    </Button>
                    <button
                      type="button"
                      className="cart-link-btn"
                      onClick={() => {
                        onClear()
                        drawerRef.current?.focus()
                      }}
                    >
                      <IconTrash />
                      Clear cart
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
