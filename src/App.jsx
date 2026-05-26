import { useState, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ProductSection from './components/ProductSection'
import Footer from './components/Footer'

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/products.json')
      .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch'))
      .then(data => setProducts(data.products))
      .catch(err => console.error('Failed to fetch products:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="loading rainbow-text">Loading...</div>
  }

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Hero />
        <ProductSection products={products} />
      </main>
      <Footer />
    </div>
  )
}

export default App
