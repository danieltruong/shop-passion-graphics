import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { placeholders } from '../content/site'
import { buyMode } from '../utils/catalog'
import Button from './Button'
import { IconCheck, IconSparkle } from './icons'
import './BuyAction.css'

const ADDED_MS = 1500
const SPARKS = [1, 2, 3, 4]

// The visible "Added" swap is aria-hidden and the label only fades, so the button's name never
// changes; App's status region announces the add.
function AddToCartButton({ product, onAddToCart, size, className = '', children }) {
  const reduceMotion = useReducedMotion()
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    if (!burst) return undefined
    const timer = setTimeout(() => setBurst(0), ADDED_MS)
    return () => clearTimeout(timer)
  }, [burst])

  return (
    <Button
      size={size}
      className={`buy-action ${className}`.trim()}
      onClick={(event) => {
        if (onAddToCart(product, event)) setBurst((n) => n + 1)
      }}
    >
      <span className={burst ? 'buy-action__label is-hidden' : 'buy-action__label'}>{children}</span>
      {burst > 0 && (
        <span className="buy-action__added" aria-hidden="true">
          Added <IconCheck />
        </span>
      )}
      {burst > 0 &&
        !reduceMotion &&
        SPARKS.map((n) => (
          <motion.span
            key={`${burst}-${n}`}
            className={`buy-action__spark buy-action__spark--${n}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.6] }}
            transition={{ duration: 0.8, delay: n * 0.08, ease: 'easeOut' }}
          >
            <IconSparkle size={n % 2 ? 14 : 10} />
          </motion.span>
        ))}
    </Button>
  )
}

export default function BuyAction({ product, onAddToCart, size, className, nameInLabel = false }) {
  // For buttons that repeat on one page: the hidden name tells them apart for screen readers.
  const forName = nameInLabel && <span className="visually-hidden">: {product.name}</span>

  switch (buyMode(product, onAddToCart)) {
    case 'sold-out':
      return (
        <Button variant="win" size={size} href={placeholders.emailHref} className={className}>
          Email me when it&apos;s back{forName}
        </Button>
      )
    case 'cart':
      return (
        <AddToCartButton
          key={product.stripePriceId}
          product={product}
          onAddToCart={onAddToCart}
          size={size}
          className={className}
        >
          Add to cart{forName}
        </AddToCartButton>
      )
    case 'link':
      return (
        <Button href={product.paymentLink} size={size} className={className}>
          Buy now{forName}
        </Button>
      )
    default:
      return (
        <Button size={size} className={className} disabled>
          Coming soon{forName}
        </Button>
      )
  }
}
