// Catalog helpers shared by the app and scripts/generate-products.js, so no Vite-only imports.

const BADGES = ['new', 'sold_out']
export const MAX_IMAGES = 8

export const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

const STRIPE_PAYMENT_LINK = /^https:\/\/buy\.stripe\.com\//

export function isStripePaymentLink(url) {
  return typeof url === 'string' && STRIPE_PAYMENT_LINK.test(url)
}

/** "Sobble Cart" -> "sobble-cart". Accents are folded; anything else non-alphanumeric splits. */
export function slugify(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Explicit slug, else one from the name, else the product id; always in slugify form. */
export function slugFor(slug, name, id) {
  return slugify(slug) || slugify(name) || slugify(id)
}

/** Non-empty string URLs, at most MAX_IMAGES of them. */
export function imageList(images) {
  return (Array.isArray(images) ? images : [])
    .filter((src) => typeof src === 'string' && src)
    .slice(0, MAX_IMAGES)
}

/** Known badge or null; empty and unknown values both mean no badge. */
export function normalizeBadge(value) {
  return BADGES.includes(value) ? value : null
}

/** Fill the fields older catalogs lack and drop any paymentLink that is not a Stripe one. */
export function normalizeProduct(raw) {
  const images = imageList(Array.isArray(raw.images) && raw.images.length > 0 ? raw.images : [raw.imageUrl])

  let paymentLink = null
  if (isStripePaymentLink(raw.paymentLink)) {
    paymentLink = raw.paymentLink
  } else if (raw.paymentLink) {
    console.warn('[shop] Dropped non-Stripe paymentLink for', raw.productId)
  }

  return {
    ...raw,
    slug: slugFor(raw.slug, raw.name, raw.productId),
    category: raw.category || null,
    badge: normalizeBadge(raw.badge),
    images,
    imageUrl: images[0] ?? '',
    paymentLink,
  }
}

/** Distinct categories in catalog order. */
export function categoriesOf(products) {
  return [...new Set(products.map((p) => p.category).filter(Boolean))]
}

/** `category` and `badge` null mean all; `query` matches name or description, case-insensitive. */
export function filterProducts(products, { category = null, badge = null, query = '' } = {}) {
  const q = query.trim().toLowerCase()
  return products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!badge || p.badge === badge) &&
      (!q || `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)),
  )
}

// Products without a price go last in either direction.
const byPrice = (dir) => (a, b) => {
  const hasA = Number.isFinite(a.price)
  const hasB = Number.isFinite(b.price)
  if (hasA !== hasB) return hasA ? -1 : 1
  return hasA ? dir * (a.price - b.price) : 0
}

/** Returns a new array. 'newest' keeps catalog order, which Stripe lists newest first. */
export function sortProducts(products, sort = 'newest') {
  const list = [...products]
  if (sort === 'price-asc') list.sort(byPrice(1))
  if (sort === 'price-desc') list.sort(byPrice(-1))
  return list
}

export function findBySlug(products, slug) {
  return products.find((p) => p.slug === slug) ?? null
}

/** Up to `limit` other products, same category first. */
export function relatedTo(products, product, limit = 4) {
  const others = products.filter((p) => p.productId !== product.productId)
  const same = others.filter((p) => product.category && p.category === product.category)
  const rest = others.filter((p) => !same.includes(p))
  return [...same, ...rest].slice(0, limit)
}
