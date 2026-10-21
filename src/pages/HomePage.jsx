import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import Button from '../components/Button'
import PriceSticker from '../components/PriceSticker'
import ProductImage from '../components/ProductImage'
import ProductSection from '../components/ProductSection'
import Starburst from '../components/Starburst'
import Window from '../components/Window'
import { IconArrowDown, IconFrog, IconGift, IconLock, IconSparkle, IconTruck } from '../components/icons'
import { hero, placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import { normalizeBadge, SORTS } from '../utils/catalog'
import './HomePage.css'

const DEFAULT_SORT = SORTS[0].value

const TRUST = [
  {
    Icon: IconLock,
    title: 'Secure checkout',
    short: 'Secure Stripe checkout',
    text: 'Payments handled by Stripe',
  },
  {
    Icon: IconTruck,
    title: `Ships in ${policies.dispatchTime}`,
    short: `Ships in ${policies.dispatchTime.replace(' business', '')}`,
    text: 'Packed by hand',
  },
  {
    Icon: IconGift,
    title: `Free shipping over ${placeholders.freeShippingThreshold}`,
    short: `Free over ${placeholders.freeShippingThreshold}`,
    text: 'On orders within Canada',
  },
]

function Featured({ product }) {
  return (
    <div className="home-featured">
      <Window title="Featured" controls>
        <div className="home-featured__body">
          <div className="home-featured__media sunken">
            <ProductImage
              className="home-featured__img"
              src={product.imageUrl}
              alt={product.name}
              decoding="async"
            />
            {Number.isFinite(product.price) && (
              <PriceSticker
                className="home-featured__price"
                amount={product.price}
                currency={product.currency}
                rotate={6}
              />
            )}
            {product.badge === 'new' && <Starburst size="lg" />}
          </div>
          <div className="home-featured__info">
            <div className="home-featured__text">
              <p className="home-featured__name">{product.name}</p>
              {product.description && <p className="home-featured__hook">{product.description}</p>}
            </div>
            <Button variant="win" to={`/products/${product.slug}`} className="home-featured__link">
              View it<span className="visually-hidden">: {product.name}</span>
            </Button>
          </div>
        </div>
      </Window>
      <IconSparkle size={44} className="home-featured__sparkle" />
    </div>
  )
}

export default function HomePage({ products = [], loading = false, loadError = null, onAddToCart }) {
  // Filters live in the URL so Back from a product page restores them; the header search sets `q`.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const category = searchParams.get('category')
  const badge = normalizeBadge(searchParams.get('badge'))
  const sortParam = searchParams.get('sort')
  const sort = SORTS.some((s) => s.value === sortParam) ? sortParam : DEFAULT_SORT

  usePageTitle()

  // BrowserRouter renders URL changes in a transition, so `searchParams` (and the updater's
  // `prev`) can lag the URL; build each change on the last params written here.
  const liveParams = useRef(searchParams)
  useEffect(() => {
    liveParams.current = searchParams
  }, [searchParams])

  function setParam(key, value, fallback) {
    const next = new URLSearchParams(liveParams.current)
    if (value && value !== fallback) next.set(key, value)
    else next.delete(key)
    liveParams.current = next
    setSearchParams(next, { replace: true })
  }

  const featured =
    !loading && !loadError
      ? (products.find((p) => p.badge === 'new') ?? products.find((p) => p.badge !== 'sold_out'))
      : undefined

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero__text">
          <p className="home-hero__kicker">{hero.kicker}</p>
          <h1 id="hero-title" className="home-hero__title rainbow-text">
            {hero.title}
          </h1>
          <p className="home-hero__lead">{hero.lead}</p>
          <div className="home-hero__actions">
            <Button href="#shop" size="lg">
              Shop the collection
              <IconArrowDown />
            </Button>
            <Button variant="win" to="/about" className="home-hero__about">
              About the shop
            </Button>
          </div>
        </div>
        {featured && <Featured product={featured} />}
      </section>

      <section className="home-trust" aria-label="Why shop here">
        <ul className="home-trust__list">
          {TRUST.map(({ Icon, title, short, text }) => (
            <li key={title} className="home-trust__tile">
              <Icon size={30} className="home-trust__icon" />
              <span className="home-trust__copy">
                <strong className="home-trust__title">{title}</strong>
                <strong className="home-trust__short">{short}</strong>
                <span className="home-trust__text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ProductSection
        products={products}
        loading={loading}
        loadError={loadError}
        onAddToCart={onAddToCart}
        category={category}
        onCategoryChange={(value) => setParam('category', value, null)}
        sort={sort}
        onSortChange={(value) => setParam('sort', value, DEFAULT_SORT)}
        query={query}
        onClearQuery={() => setParam('q', null)}
        badge={badge}
        onClearBadge={() => setParam('badge', null)}
      />

      <Window title="About the shop" className="home-about">
        <IconFrog size={88} className="home-about__frog" />
        <div className="home-about__text">
          <h2 className="home-about__title">Made by hand, packed by hand.</h2>
          <p>
            We make everything in small batches, so no two pieces are exactly alike, and when
            something sells out it may be a little while before it&apos;s back.
          </p>
          <div>
            <Button variant="win" to="/about">
              More about the shop
            </Button>
          </div>
        </div>
      </Window>
    </div>
  )
}
