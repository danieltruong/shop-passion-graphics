import { motion } from 'framer-motion'
import { fadeInUp, DURATIONS } from '../utils/animations'

/**
 * ProductCard — displays a single product with image, price, and cart button.
 *
 * Products with a stripePriceId get an "Add to Cart" button.
 * Products without one (no price configured in Stripe) show "Coming Soon".
 *
 * Props:
 *   product     ProductObject  — from products.json
 *   onAddToCart (product) => void
 */
export default function ProductCard({ product, onAddToCart }) {
  return (
    <motion.div
      className="product-card"
      variants={fadeInUp}
      whileHover={{ scale: 1.03, transition: { duration: DURATIONS.fast } }}
    >
      <div className="product-image">
        <img src={product.imageUrl} alt={product.name} />
        <motion.div
          className="product-price"
          initial={{ scale: 0, rotate: -10 }}
          whileInView={{ scale: 1, rotate: 5 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
        >
          {product.currency} ${(product.price / 100).toFixed(2)}
        </motion.div>
      </div>

      <div className="product-details">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.description}</p>

        <div className="product-footer">
          {product.stripePriceId ? (
            <motion.button
              className="btn-buy"
              onClick={() => onAddToCart(product)}
              whileHover={{ scale: 1.05, transition: { duration: DURATIONS.fast } }}
              whileTap={{ scale: 0.95, transition: { duration: DURATIONS.instant } }}
            >
              🛒 Add to Cart
            </motion.button>
          ) : (
            <button className="btn-buy disabled" disabled>
              Coming Soon
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
