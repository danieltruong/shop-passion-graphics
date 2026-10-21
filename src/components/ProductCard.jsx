import { memo } from 'react'
import { Link } from 'react-router'
import BuyAction from './BuyAction'
import PriceSticker from './PriceSticker'
import ProductImage from './ProductImage'
import Starburst from './Starburst'
import './ProductCard.css'

// Memoized: every cart change re-renders App, and the whole grid with it.
function ProductCard({ product, onAddToCart }) {
  return (
    <article className="shop-card">
      <div className="shop-card__body">
        <h3 className="shop-card__name">
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        {product.description && <p className="shop-card__blurb">{product.description}</p>}
        <BuyAction product={product} onAddToCart={onAddToCart} className="shop-card__cta" nameInLabel />
      </div>

      <div className="shop-card__media">
        <ProductImage
          className="shop-card__img"
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
        />
        {Number.isFinite(product.price) && (
          <PriceSticker
            className="shop-card__price"
            amount={product.price}
            currency={product.currency}
          />
        )}
        {product.badge === 'new' && <Starburst />}
        {product.badge === 'sold_out' && (
          <div className="shop-card__sold">
            <span className="shop-card__sold-label">SOLD OUT</span>
          </div>
        )}
      </div>
    </article>
  )
}

export default memo(ProductCard)
