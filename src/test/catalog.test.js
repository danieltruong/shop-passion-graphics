import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  MAX_IMAGES,
  categoriesOf,
  filterProducts,
  findBySlug,
  imageList,
  isStripePaymentLink,
  normalizeBadge,
  normalizeProduct,
  relatedTo,
  slugFor,
  slugify,
  sortProducts,
} from '../utils/catalog'
import { badLink, euroThing, frog, soldOut, sobble, unpriced } from './fixtures'

const names = (list) => list.map((p) => p.name)

describe('isStripePaymentLink', () => {
  it('accepts an https link on buy.stripe.com', () => {
    expect(isStripePaymentLink('https://buy.stripe.com/test_abc')).toBe(true)
  })

  it('rejects a look-alike host that starts with buy.stripe.com', () => {
    expect(isStripePaymentLink('https://buy.stripe.com.evil.example/test_abc')).toBe(false)
  })

  it('rejects plain http', () => {
    expect(isStripePaymentLink('http://buy.stripe.com/test_abc')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isStripePaymentLink(null)).toBe(false)
    expect(isStripePaymentLink(undefined)).toBe(false)
    expect(isStripePaymentLink({ href: 'https://buy.stripe.com/x' })).toBe(false)
  })
})

describe('slugify', () => {
  it('folds accents and lowercases', () => {
    expect(slugify('Café Frog')).toBe('cafe-frog')
  })

  it('folds accents inside a word instead of splitting it', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee')
  })

  it('collapses runs of other characters into one dash and trims the ends', () => {
    expect(slugify('  Sobble -- Cart!! ')).toBe('sobble-cart')
  })

  it('gives an empty string for null', () => {
    expect(slugify(null)).toBe('')
  })
})

describe('slugFor', () => {
  it('prefers the explicit slug, slugified', () => {
    expect(slugFor('My Slug', 'Frog', 'prod_1')).toBe('my-slug')
  })

  it('falls back to the name', () => {
    expect(slugFor('', 'Sobble Cart', 'prod_1')).toBe('sobble-cart')
  })

  it('falls back to the product id when name has no slug characters', () => {
    expect(slugFor(undefined, '!!!', 'prod_1')).toBe('prod_1')
  })
})

describe('imageList', () => {
  it(`keeps at most ${MAX_IMAGES} images`, () => {
    const many = Array.from({ length: MAX_IMAGES + 3 }, (_, i) => `https://img/${i}`)
    expect(imageList(many)).toHaveLength(8)
    expect(imageList(many).at(-1)).toBe('https://img/7')
  })

  it('drops empty and non-string entries', () => {
    expect(imageList(['https://a', '', null, 3, 'https://b'])).toEqual(['https://a', 'https://b'])
  })

  it('returns [] for a non-array', () => {
    expect(imageList('https://a')).toEqual([])
    expect(imageList(undefined)).toEqual([])
  })
})

describe('normalizeBadge', () => {
  it('keeps known badges and maps anything else to null', () => {
    expect(normalizeBadge('new')).toBe('new')
    expect(normalizeBadge('sold_out')).toBe('sold_out')
    expect(normalizeBadge('NEW')).toBe(null)
    expect(normalizeBadge('')).toBe(null)
  })
})

describe('normalizeProduct', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drops a non-Stripe paymentLink and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeProduct(badLink).paymentLink).toBe(null)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('keeps a Stripe paymentLink without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeProduct(frog).paymentLink).toBe('https://buy.stripe.com/test_frog')
    expect(warn).not.toHaveBeenCalled()
  })

  it('builds images from imageUrl for the older catalog shape', () => {
    const p = normalizeProduct(euroThing)
    expect(p.images).toEqual(['https://files.stripe.com/links/euro'])
    expect(p.imageUrl).toBe('https://files.stripe.com/links/euro')
  })

  it('sets imageUrl to the first image', () => {
    const p = normalizeProduct({ ...frog, imageUrl: 'https://old', images: ['https://first', 'https://second'] })
    expect(p.imageUrl).toBe('https://first')
  })

  it('gives an empty imageUrl when there are no images at all', () => {
    const p = normalizeProduct({ ...euroThing, imageUrl: '' })
    expect(p.images).toEqual([])
    expect(p.imageUrl).toBe('')
  })

  it('derives a slug from the name when the catalog has none', () => {
    expect(normalizeProduct(euroThing).slug).toBe('euro-thing')
  })

  it('maps empty category and unknown badge to null', () => {
    const p = normalizeProduct({ ...frog, category: '', badge: 'hot' })
    expect(p.category).toBe(null)
    expect(p.badge).toBe(null)
  })
})

describe('categoriesOf', () => {
  it('lists distinct categories in catalog order and skips empty ones', () => {
    expect(categoriesOf([sobble, frog, soldOut, unpriced])).toEqual(['Stickers', 'Prints'])
  })
})

describe('filterProducts', () => {
  const all = [frog, sobble, soldOut, unpriced]

  it('returns everything with no filters', () => {
    expect(names(filterProducts(all))).toEqual(['Frog', 'Sobble Cart', 'Old Frog', 'Mystery Item'])
  })

  it('filters by category', () => {
    expect(names(filterProducts(all, { category: 'Stickers' }))).toEqual(['Sobble Cart', 'Old Frog'])
  })

  it('filters by badge', () => {
    expect(names(filterProducts(all, { badge: 'sold_out' }))).toEqual(['Old Frog'])
  })

  it('matches the query against name or description, ignoring case and spaces', () => {
    expect(names(filterProducts(all, { query: '  FROG ' }))).toEqual(['Frog', 'Old Frog'])
    expect(names(filterProducts(all, { query: 'prison' }))).toEqual(['Sobble Cart'])
  })

  it('combines filters', () => {
    expect(names(filterProducts(all, { category: 'Stickers', query: 'frog' }))).toEqual(['Old Frog'])
  })
})

describe('sortProducts', () => {
  const noPrice = { ...unpriced, productId: 'prod_np', name: 'No Price', price: undefined }
  const list = [frog, noPrice, sobble, soldOut]

  it('keeps catalog order for newest', () => {
    expect(names(sortProducts(list, 'newest'))).toEqual(['Frog', 'No Price', 'Sobble Cart', 'Old Frog'])
  })

  it('sorts ascending with unpriced last', () => {
    expect(names(sortProducts(list, 'price-asc'))).toEqual(['Old Frog', 'Sobble Cart', 'Frog', 'No Price'])
  })

  it('sorts descending with unpriced still last', () => {
    expect(names(sortProducts(list, 'price-desc'))).toEqual(['Frog', 'Sobble Cart', 'Old Frog', 'No Price'])
  })

  it('does not reorder the input array', () => {
    sortProducts(list, 'price-asc')
    expect(names(list)).toEqual(['Frog', 'No Price', 'Sobble Cart', 'Old Frog'])
  })
})

describe('findBySlug', () => {
  it('finds the product with that slug, or null', () => {
    expect(findBySlug([frog, sobble], 'sobble-cart')).toBe(sobble)
    expect(findBySlug([frog, sobble], 'nope')).toBe(null)
  })
})

describe('relatedTo', () => {
  const a = { ...frog, productId: 'a', name: 'A', category: 'Prints' }
  const b = { ...frog, productId: 'b', name: 'B', category: 'Stickers' }
  const c = { ...frog, productId: 'c', name: 'C', category: 'Prints' }
  const d = { ...frog, productId: 'd', name: 'D', category: null }

  it('excludes the product itself and puts the same category first', () => {
    expect(names(relatedTo([a, b, c, d], a))).toEqual(['C', 'B', 'D'])
  })

  it('caps the list at the limit', () => {
    expect(names(relatedTo([a, b, c, d], a, 2))).toEqual(['C', 'B'])
  })

  it('treats a product with no category as having no same-category matches', () => {
    const e = { ...d, productId: 'e', name: 'E' }
    expect(names(relatedTo([d, a, e], d))).toEqual(['A', 'E'])
  })
})
