import { useCallback, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useParams } from 'react-router'
import Accordion from '../components/Accordion'
import BuyAction from '../components/BuyAction'
import LoadError from '../components/LoadError'
import PriceSticker from '../components/PriceSticker'
import ProductCard from '../components/ProductCard'
import ProductGallery from '../components/ProductGallery'
import Starburst from '../components/Starburst'
import { IconCheck, IconLock } from '../components/icons'
import { placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import { findBySlug, relatedTo, slugify } from '../utils/catalog'
import { formatPrice } from '../utils/formatPrice'
import NotFoundPage from './NotFoundPage'
import './ProductPage.css'

export default function ProductPage({ products = [], loading = false, loadError = null }) {
  const { slug } = useParams()
  const product = findBySlug(products, slugify(slug))
  usePageTitle(product?.name ?? (loadError ? 'Shop unavailable' : null))
  const reduceMotion = useReducedMotion()
  const [ctaPassed, setCtaPassed] = useState(false)

  // The mobile buy bar shows only once the main CTA is above the viewport. The huge bottom
  // margin keeps the CTA "intersecting" anywhere below the top, so a jump past it still fires.
  const watchCta = useCallback((el) => {
    if (!el) return undefined
    const observer = new IntersectionObserver(([entry]) => setCtaPassed(!entry.isIntersecting), {
      rootMargin: '0px 0px 100000px 0px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (loading) {
    return (
      <div className="product-page">
        <h1 className="visually-hidden">Loading product</h1>
        <p className="product-page__message">Loading...</p>
      </div>
    )
  }
  if (!product) {
    if (loadError) {
      return (
        <div className="product-page">
          <h1 className="visually-hidden">Shop unavailable</h1>
          <LoadError className="product-page__message" />
        </div>
      )
    }
    return <NotFoundPage />
  }

  const soldOut = product.badge === 'sold_out'
  const hasPrice = Number.isFinite(product.price)
  const related = relatedTo(products, product)

  return (
    <div className="product-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol className="breadcrumb__list">
          <li>
            <Link to="/">Home</Link>
          </li>
          {product.category && (
            <li>
              <span className="breadcrumb__sep" aria-hidden="true">›</span>
              {product.category}
            </li>
          )}
          <li>
            <span className="breadcrumb__sep" aria-hidden="true">›</span>
            <span aria-current="page">{product.name}</span>
          </li>
        </ol>
      </nav>

      <div className="product">
        <div className="product__info">
          <h1 className="product__name">{product.name}</h1>
          {hasPrice && (
            <PriceSticker amount={product.price} currency={product.currency} rotate={-3} size="lg" />
          )}
          {soldOut && <p className="product__stock product__stock--sold">Sold out</p>}
          {!soldOut && product.paymentLink && (
            <p className="product__stock">
              <IconCheck />
              In stock, ships in {policies.dispatchTime}
            </p>
          )}
          {product.description && <p className="product__description">{product.description}</p>}
          <div ref={watchCta} className="product__cta-wrap">
            <BuyAction product={product} size="xl" className="product__cta" />
          </div>
          <p className="product__trust">
            <IconLock />
            Secure checkout by Stripe · Free shipping in Canada over {placeholders.freeShippingThreshold}
          </p>

          <div className="product__details bevel">
            <Accordion title="Details" variant="title" headingLevel={2} defaultOpen>
              {placeholders.productDetails} Because each one is made by hand, yours may vary slightly
              from the photos.
            </Accordion>
            <Accordion title="Shipping & returns" variant="title" headingLevel={2}>
              Ships from {policies.shipsFrom} in {policies.dispatchTime}. Unused items can be returned
              within {policies.returnWindowDays} days of delivery; custom and personalized pieces are
              final sale. <Link to="/shipping">Full policy</Link>
            </Accordion>
            <Accordion title="About the design" variant="title" headingLevel={2}>
              {placeholders.designStory}
            </Accordion>
          </div>
        </div>

        <div className="product__media">
          <ProductGallery key={product.slug} images={product.images} name={product.name} />
          {product.badge === 'new' && <Starburst size="xl" />}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title" className="related__title">You might also like</h2>
          <ul className="related__list">
            {related.map((item) => (
              <li key={item.productId}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {ctaPassed && (soldOut || product.paymentLink) && (
          <motion.div
            className="product-bar"
            initial={reduceMotion ? false : { y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: '100%', opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="product-bar__summary">
              <span className="product-bar__name">{product.name}</span>
              {hasPrice && (
                <span className="product-bar__price">{formatPrice(product.price, product.currency)}</span>
              )}
            </div>
            <BuyAction product={product} size="lg" className="product__cta" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
