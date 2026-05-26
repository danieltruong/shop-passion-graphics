import { motion } from 'framer-motion'
import ProductCard from './ProductCard'
import { scaleIn, staggerContainer, VIEWPORTS } from '../utils/animations'

export default function ProductSection({ products }) {
  if (!products || products.length === 0) {
    return (
      <section className="product-section" style={{ textAlign: 'center' }}>
        <h2 className="section-title rainbow-text">Shop</h2>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
          Products coming soon... the artist is still creating 🎨
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
        ✨ Shop ✨
      </motion.h2>
      <motion.div
        className="product-grid"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORTS.default}
        variants={staggerContainer(0.15)}
      >
        {products.map((product) => (
          <ProductCard key={product.productId} product={product} />
        ))}
      </motion.div>
    </section>
  )
}
