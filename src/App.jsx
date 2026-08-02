import { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ProductSection from './components/ProductSection'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import SuccessBanner from './components/SuccessBanner'
import * as cartOps from './utils/cart'

/** True when the browser has just come back from a completed Stripe Checkout. */
function isCheckoutReturn() {
  return typeof window !== 'undefined' && window.location.pathname === '/success'
}

/**
 * App — root component.
 *
 * Owns cart state and passes it to Header (for CartIcon) and CartDrawer. The tree is shallow
 * enough that Context would add indirection without removing any drilling.
 *
 * Cart shape: [{ product: ProductObject, quantity: number }]
 * Cart mutation lives in src/utils/cart.js as pure functions so it can be tested directly.
 */
function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  // Distinct from "no products": a failed fetch previously rendered as an empty catalog,
  // so a CDN outage looked identical to a shop with nothing for sale.
  const [loadError, setLoadError] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [cartError, setCartError] = useState(null)

  // The element that opened the drawer, so focus can be returned to it on close.
  const cartTriggerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    fetch('/products.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products (HTTP ${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = data.products ?? []
        setProducts(list)
        // Restore the cart only once the catalog is known — stored lines are re-hydrated
        // from it so prices can never go stale and archived products drop out.
        // After a completed checkout the cart is spent, so start empty instead.
        setCart(isCheckoutReturn() ? [] : cartOps.loadCart(list))
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to fetch products:', err)
        setLoadError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Persist on every change so the Stripe cancel redirect (back to `/`) doesn't lose the cart.
  useEffect(() => {
    if (!loading) cartOps.saveCart(cart)
  }, [cart, loading])

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const { cart: next, error } = cartOps.addToCart(prev, product)
      setCartError(error ?? null)
      return next
    })
    setCartOpen(true)
  }, [])

  const updateQuantity = useCallback((key, qty) => {
    setCartError(null)
    setCart((prev) => cartOps.updateQuantity(prev, key, qty))
  }, [])

  const clearCart = useCallback(() => {
    setCartError(null)
    setCart([])
  }, [])

  const openCart = useCallback((event) => {
    cartTriggerRef.current = event?.currentTarget ?? null
    setCartOpen(true)
  }, [])

  const closeCart = useCallback(() => {
    setCartOpen(false)
    // a11y 2.4.3 Focus Order — send focus back to the control that opened the dialog.
    cartTriggerRef.current?.focus()
  }, [])

  return (
    <div className="app">
      {/* First tab stop — skips the decorative header and cart button. */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <Header cart={cart} onCartOpen={openCart} />

      <main className="main-content" id="main-content" tabIndex={-1}>
        <SuccessBanner />
        <Hero />
        {loading ? (
          <p className="loading rainbow-text" role="status">
            Loading...
          </p>
        ) : (
          <ProductSection
            products={products}
            onAddToCart={addToCart}
            loadError={loadError}
          />
        )}
      </main>

      <Footer />

      <CartDrawer
        cart={cart}
        isOpen={cartOpen}
        onClose={closeCart}
        onUpdateQty={updateQuantity}
        onClear={clearCart}
        error={cartError}
      />
    </div>
  )
}

export default App
