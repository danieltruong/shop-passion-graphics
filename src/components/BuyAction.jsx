import { placeholders } from '../content/site'
import Button from './Button'

/** Sold out, then add to cart, then Payment Link, else a disabled "Coming soon". */
export default function BuyAction({ product, onAddToCart, size, className, nameInLabel = false }) {
  // For buttons that repeat on one page: the hidden name tells them apart for screen readers.
  const forName = nameInLabel && <span className="visually-hidden">: {product.name}</span>

  if (product.badge === 'sold_out') {
    return (
      <Button variant="win" size={size} href={placeholders.emailHref} className={className}>
        Email me when it&apos;s back{forName}
      </Button>
    )
  }
  if (onAddToCart && product.stripePriceId) {
    return (
      <Button size={size} className={className} onClick={() => onAddToCart(product)}>
        Add to cart{forName}
      </Button>
    )
  }
  if (!onAddToCart && product.paymentLink) {
    return (
      <Button href={product.paymentLink} size={size} className={className}>
        Buy now{forName}
      </Button>
    )
  }
  return (
    <Button size={size} className={className} disabled>
      Coming soon{forName}
    </Button>
  )
}
