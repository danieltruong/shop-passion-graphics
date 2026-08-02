import { memo } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, DURATIONS } from '../utils/animations'
import { formatPrice } from '../utils/formatPrice'

/** Shipped in public/ — used when a Stripe product has no image. */
const PLACEHOLDER = '/product_placeholder.svg'

/**
 * ProductCard — displays a single product with image, price, and cart button.
 *
 * Products with a stripePriceId get an "Add to Cart" button.
 * Products without one (no price configured in Stripe) show "Coming Soon".
 *
 * Memoized: every cart mutation re-renders App, and each card carries a hover animation plus
 * a spring-animated price badge, so re-rendering the whole grid on every "+" click is real work.
 *
 * Props:
 *   product     ProductObject  — from products.json
 *   onAddToCart (product) => void
 */
function ProductCard({ product, onAddToCart }) {
  return (
    <motion.div
      className="product-card"
      variants={fadeInUp}
      whileHover={{ scale: 1.03, transition: { duration: DURATIONS.fast } }}
    >
      <div className="product-image">
        <img
          src={product.imageUrl || PLACEHOLDER}
          alt={product.name}
          // Stripe's files.stripe.com links are account-scoped and can be rotated, which
          // would otherwise leave a broken-image icon on the card.
          onError={(e) => {
            if (e.currentTarget.src.endsWith(PLACEHOLDER)) return
            e.currentTarget.src = PLACEHOLDER
          }}
        />
        <motion.div
          className="product-price"
          initial={{ scale: 0, rotate: -10 }}
          whileInView={{ scale: 1, rotate: 5 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
        >
          {formatPrice(product.price, product.currency)}
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
              <span aria-hidden="true">🛒</span> Add to Cart
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

export default memo(ProductCard)
