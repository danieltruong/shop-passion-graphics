import { motion } from 'framer-motion'
import ProductCard from './ProductCard'
import { scaleIn, staggerContainer, VIEWPORTS } from '../utils/animations'
import { lineKey } from '../utils/cart'

/**
 * Hoisted to module scope. staggerContainer() is a factory, and Framer propagates variants by
 * reference — calling it inline handed Framer a brand-new variant tree on every render.
 */
const GRID_STAGGER = staggerContainer(0.15)

/**
 * ProductSection — grid of ProductCard components.
 *
 * Props:
 *   products    ProductObject[]       — from products.json
 *   onAddToCart (product) => void     — forwarded to each ProductCard
 *   loadError   string | null         — set when the catalog fetch failed
 */
export default function ProductSection({ products, onAddToCart, loadError }) {
  // A failed fetch is NOT an empty shop. Previously both rendered "coming soon", so a CDN
  // outage was indistinguishable from a catalogue with nothing in it.
  if (loadError) {
    return (
      <section className="product-section" style={{ textAlign: 'center' }}>
        <h2 className="section-title rainbow-text">Shop</h2>
        <p className="product-section-message" role="alert">
          We couldn&apos;t load the shop just now.{' '}
          <button className="link-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
      </section>
    )
  }

  if (!products || products.length === 0) {
    return (
      <section className="product-section" style={{ textAlign: 'center' }}>
        <h2 className="section-title rainbow-text">Shop</h2>
        <p className="product-section-message">
          Products coming soon... the artist is still creating{' '}
          <span aria-hidden="true">🎨</span>
        </p>
      </section>
    )
  }

  return (
    <section className="product-section">
      <motion.h2
        className="section-title rainbow-text"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORTS.default}
        variants={scaleIn}
      >
        <span aria-hidden="true">✨</span> Shop <span aria-hidden="true">✨</span>
      </motion.h2>
      <motion.div
        className="product-grid"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORTS.default}
        variants={GRID_STAGGER}
      >
        {products.map((product) => (
          <ProductCard key={lineKey(product)} product={product} onAddToCart={onAddToCart} />
        ))}
      </motion.div>
    </section>
  )
}
