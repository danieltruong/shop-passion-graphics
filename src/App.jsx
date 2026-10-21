import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import CartDrawer from './components/CartDrawer'
import Starfield from './components/Starfield'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import AboutPage from './pages/AboutPage'
import FaqPage from './pages/FaqPage'
import ShippingPage from './pages/ShippingPage'
import SuccessPage from './pages/SuccessPage'
import PrivacyPage from './pages/PrivacyPage'
import NotFoundPage from './pages/NotFoundPage'
import { CART_ENABLED } from './features'
import { normalizeProduct } from './utils/catalog'
import * as cartOps from './utils/cart'

// Cart state ([{ product, quantity }]) lives here, not in Context: the tree is shallow.
// Mutations are pure functions in src/utils/cart.js so they can be tested directly.
function App() {
  const { pathname, hash, key } = useLocation()
  const navigationType = useNavigationType()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  // Distinct from "no products", so a CDN outage does not look like a shop with nothing for sale.
  const [loadError, setLoadError] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [cartError, setCartError] = useState(null)
  const [animationsPaused, setAnimationsPaused] = useState(false)

  // Stripe returns to /success after a completed checkout; only the first location counts.
  const checkoutReturnRef = useRef(pathname === '/success')
  // The element that opened the drawer, so focus can be returned to it on close.
  const cartTriggerRef = useRef(null)
  const lastPathnameRef = useRef(pathname)

  useEffect(() => {
    let cancelled = false

    fetch('/products.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products (HTTP ${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = (data.products ?? []).map(normalizeProduct)
        setProducts(list)
        // Stored lines are re-hydrated from the catalog so prices never go stale and archived
        // products drop out. After a completed checkout the cart is spent, so start empty.
        setCart(checkoutReturnRef.current ? [] : cartOps.loadCart(list))
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

  // BrowserRouter never scrolls, so links do it here. POP (reload, back, forward) keeps its place.
  useEffect(() => {
    const pathnameChanged = lastPathnameRef.current !== pathname
    lastPathnameRef.current = pathname
    if (navigationType === 'POP') return
    // A query-only change (search, filters, sort) keeps its place.
    if (!hash && !pathnameChanged) return
    // a11y 2.4.3: screen readers start on the new page; covers focus lost with the closed mobile menu.
    document.getElementById('main-content')?.focus({ preventScroll: true })
    const target = hash ? document.getElementById(hash.slice(1)) : null
    // A missing target falls back to the top. 'instant' overrides the smooth scroll in index.css.
    if (target) target.scrollIntoView()
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [key, pathname, hash, navigationType])

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

  const catalog = { products, loading, loadError }

  return (
    <div className="app" data-animations-paused={animationsPaused || undefined}>
      <Starfield />
      {/* Always mounted, so text changes are announced; pages keep their visible loading text. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {loading ? 'Loading the shop' : ''}
      </div>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <SiteHeader
        cartEnabled={CART_ENABLED}
        cart={cart}
        onCartOpen={openCart}
        animationsPaused={animationsPaused}
        onToggleAnimations={() => setAnimationsPaused((paused) => !paused)}
      />

      <main className="main-content" id="main-content" tabIndex={-1}>
        <Routes>
          <Route
            path="/"
            element={<HomePage {...catalog} onAddToCart={CART_ENABLED ? addToCart : undefined} />}
          />
          <Route path="/products/:slug" element={<ProductPage {...catalog} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/shipping" element={<ShippingPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <SiteFooter />

      {CART_ENABLED && (
        <CartDrawer
          cart={cart}
          isOpen={cartOpen}
          onClose={closeCart}
          onUpdateQty={updateQuantity}
          onClear={clearCart}
          error={cartError}
        />
      )}
    </div>
  )
}

export default App
