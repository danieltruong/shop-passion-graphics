import { useState, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ProductSection from './components/ProductSection'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'

/**
 * App — root component.
 *
 * Owns cart state so Header (CartIcon) and ProductSection (Add to Cart)
 * share the same source of truth without prop-drilling through context.
 *
 * Cart shape: [{ product: ProductObject, quantity: number }]
 */
function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    fetch('/products.json')
      .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch'))
      .then(data => setProducts(data.products))
      .catch(err => console.error('Failed to fetch products:', err))
      .finally(() => setLoading(false))
  }, [])

  /** Add product to cart. If already present, increments quantity. Opens drawer. */
  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(item => item.product.productId === product.productId)
      if (existing) {
        return prev.map(item =>
          item.product.productId === product.productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setCartOpen(true)
  }

  /** Set quantity for a cart item. Passing qty=0 removes the item. */
  function updateQuantity(productId, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product.productId !== productId))
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product.productId === productId ? { ...item, quantity: qty } : item
        )
      )
    }
  }

  /** Remove all items from the cart. */
  function clearCart() {
    setCart([])
  }

  if (loading) {
    return <div className="loading rainbow-text">Loading...</div>
  }

  return (
    <div className="app">
      <Header
        cart={cart}
        onCartOpen={() => setCartOpen(true)}
      />
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Hero />
        <ProductSection products={products} onAddToCart={addToCart} />
      </main>
      <Footer />
      <CartDrawer
        cart={cart}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateQuantity}
        onClear={clearCart}
      />
    </div>
  )
}

export default App
