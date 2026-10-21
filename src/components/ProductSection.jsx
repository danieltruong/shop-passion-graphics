import FilterBar from './FilterBar'
import LoadError from './LoadError'
import ProductCard from './ProductCard'
import { IconSparkle } from './icons'
import { categoriesOf, filterProducts, sortProducts } from '../utils/catalog'
import './ProductSection.css'

const BADGE_LABELS = { new: 'New arrivals', sold_out: 'Sold out' }

function Section({ children }) {
  return (
    <section id="shop" className="shop-section" aria-labelledby="shop-title">
      <div className="shop-section__head">
        <IconSparkle size={30} className="shop-section__sparkle" />
        <h2 id="shop-title" className="shop-section__title">
          Shop
        </h2>
        <IconSparkle size={30} className="shop-section__sparkle" />
      </div>
      {children}
    </section>
  )
}

/** Filter state is controlled by the parent; `category` and `badge` null mean no filter. */
export default function ProductSection({
  products,
  loading = false,
  loadError = null,
  onAddToCart,
  category = null,
  onCategoryChange,
  sort,
  onSortChange,
  query = '',
  onClearQuery,
  badge = null,
  onClearBadge,
}) {
  if (loading) {
    return (
      <Section>
        <p className="shop-section__message">Loading...</p>
      </Section>
    )
  }

  if (loadError) {
    return (
      <Section>
        <LoadError className="shop-section__message" />
      </Section>
    )
  }

  if (!products || products.length === 0) {
    return (
      <Section>
        <p className="shop-section__message">
          Products coming soon. The artist is still creating.
        </p>
      </Section>
    )
  }

  const visible = sortProducts(filterProducts(products, { category, badge, query }), sort)
  const badgeLabel = BADGE_LABELS[badge] ?? badge

  return (
    <Section>
      <FilterBar
        categories={categoriesOf(products)}
        category={category}
        onCategoryChange={onCategoryChange}
        sort={sort}
        onSortChange={onSortChange}
        count={visible.length}
      />
      {(query || badge) && (
        <div className="shop-active">
          {query && (
            <p className="shop-active__query">
              Results for <strong>&ldquo;{query}&rdquo;</strong>
            </p>
          )}
          {badge && (
            <button
              type="button"
              className="shop-active__clear bevel"
              aria-label={`${badgeLabel}, clear filter`}
              onClick={onClearBadge}
            >
              {badgeLabel}
              <span aria-hidden="true"> ×</span>
            </button>
          )}
          {query && (
            <button type="button" className="shop-active__clear bevel" onClick={onClearQuery}>
              Clear search
            </button>
          )}
        </div>
      )}
      {visible.length > 0 ? (
        <div className="shop-grid">
          {visible.map((product) => (
            <ProductCard key={product.productId} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      ) : (
        <p className="shop-section__message">No products match. Try another category or search.</p>
      )}
    </Section>
  )
}
