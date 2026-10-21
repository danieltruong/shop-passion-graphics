import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duplicateSlugs, paymentLinksByProduct, toCatalogEntry } from './catalog-entry.js';

// Minimal shapes of Stripe list responses with expand[]=data.line_items / data.default_price.
function link({ id = 'plink_1', url = 'https://buy.stripe.com/test_1', items, hasMore = false, redirect = 'https://shop.example/success' } = {}) {
  return {
    id,
    url,
    after_completion: redirect ? { type: 'redirect', redirect: { url: redirect } } : { type: 'hosted_confirmation' },
    line_items: { data: items ?? [{ price: { id: 'price_1', product: 'prod_1' } }], has_more: hasMore },
  };
}

function product(overrides = {}) {
  return {
    id: 'prod_1',
    name: 'Café Frog',
    description: 'Ribbit',
    images: ['https://files.stripe.com/links/a'],
    active: true,
    metadata: {},
    default_price: { id: 'price_1', unit_amount: 1200, currency: 'cad' },
    ...overrides,
  };
}

let warn;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const warnings = () => warn.mock.calls.map((args) => args.join(' '));

describe('paymentLinksByProduct', () => {
  it('maps a single-item link to its product and price', () => {
    const map = paymentLinksByProduct([link()]);
    expect(map.get('prod_1')).toEqual([{ url: 'https://buy.stripe.com/test_1', priceId: 'price_1' }]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads product and price ids from expanded objects too', () => {
    const items = [{ price: { id: 'price_9', product: { id: 'prod_9' } } }];
    expect(paymentLinksByProduct([link({ items })]).get('prod_9')).toEqual([
      { url: 'https://buy.stripe.com/test_1', priceId: 'price_9' },
    ]);
  });

  it('skips a link with several line items', () => {
    const items = [
      { price: { id: 'price_1', product: 'prod_1' } },
      { price: { id: 'price_2', product: 'prod_2' } },
    ];
    const map = paymentLinksByProduct([link({ id: 'plink_multi', items })]);
    expect(map.size).toBe(0);
    expect(warnings()[0]).toContain('plink_multi has 2 line items');
  });

  it('skips a link whose line items are truncated', () => {
    expect(paymentLinksByProduct([link({ hasMore: true })]).size).toBe(0);
  });

  it('skips a link not hosted on buy.stripe.com', () => {
    const map = paymentLinksByProduct([link({ id: 'plink_evil', url: 'https://buy.stripe.com.evil.example/x' })]);
    expect(map.size).toBe(0);
    expect(warnings()[0]).toContain('plink_evil URL is not on buy.stripe.com');
  });

  it('skips a link whose line item has no product', () => {
    const items = [{ price: { id: 'price_1', product: null } }];
    expect(paymentLinksByProduct([link({ items })]).size).toBe(0);
  });

  it('keeps every link for a product, in input order', () => {
    const map = paymentLinksByProduct([
      link({ id: 'a', url: 'https://buy.stripe.com/first' }),
      link({ id: 'b', url: 'https://buy.stripe.com/second' }),
    ]);
    expect(map.get('prod_1').map((l) => l.url)).toEqual([
      'https://buy.stripe.com/first',
      'https://buy.stripe.com/second',
    ]);
  });

  it('keeps a link that does not redirect to /success but warns', () => {
    const map = paymentLinksByProduct([link({ id: 'plink_noredir', redirect: null })]);
    expect(map.get('prod_1')).toHaveLength(1);
    expect(warnings()[0]).toContain('plink_noredir does not redirect to /success');
  });

  it('does not warn for a redirect to /success with a query string', () => {
    paymentLinksByProduct([link({ redirect: 'https://shop.example/success?session_id={CHECKOUT_SESSION_ID}' })]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('toCatalogEntry', () => {
  it('maps a Stripe product onto the products.json shape', () => {
    expect(toCatalogEntry(product())).toEqual({
      productId: 'prod_1',
      name: 'Café Frog',
      description: 'Ribbit',
      price: 1200,
      currency: 'CAD',
      imageUrl: 'https://files.stripe.com/links/a',
      images: ['https://files.stripe.com/links/a'],
      slug: 'cafe-frog',
      category: null,
      badge: null,
      paymentLink: null,
      active: true,
      stripeProductId: 'prod_1',
      stripePriceId: 'price_1',
    });
  });

  it('returns null when default_price is not expanded', () => {
    expect(toCatalogEntry(product({ default_price: 'price_1' }))).toBe(null);
  });

  it('returns null when there is no default price', () => {
    expect(toCatalogEntry(product({ default_price: null }))).toBe(null);
  });

  it('picks the link on the default price', () => {
    const links = new Map([['prod_1', [{ url: 'https://buy.stripe.com/default', priceId: 'price_1' }]]]);
    expect(toCatalogEntry(product(), links).paymentLink).toBe('https://buy.stripe.com/default');
  });

  it('skips a link on another price and warns', () => {
    const links = new Map([['prod_1', [{ url: 'https://buy.stripe.com/old', priceId: 'price_old' }]]]);
    expect(toCatalogEntry(product(), links).paymentLink).toBe(null);
    expect(warnings()[0]).toContain('not on default price price_1');
  });

  it('keeps the first of several links on the default price', () => {
    const links = new Map([
      [
        'prod_1',
        [
          { url: 'https://buy.stripe.com/old', priceId: 'price_old' },
          { url: 'https://buy.stripe.com/first', priceId: 'price_1' },
          { url: 'https://buy.stripe.com/second', priceId: 'price_1' },
        ],
      ],
    ]);
    expect(toCatalogEntry(product(), links).paymentLink).toBe('https://buy.stripe.com/first');
    expect(warnings()).toContainEqual(expect.stringContaining('keeping https://buy.stripe.com/first'));
  });

  it('reads slug, category and badge from metadata', () => {
    const entry = toCatalogEntry(product({ metadata: { slug: 'My Frog', category: ' Prints ', badge: ' new ' } }));
    expect(entry.slug).toBe('my-frog');
    expect(entry.category).toBe('Prints');
    expect(entry.badge).toBe('new');
  });

  it('ignores an unknown badge and warns', () => {
    const entry = toCatalogEntry(product({ metadata: { badge: 'hot' } }));
    expect(entry.badge).toBe(null);
    expect(warnings()[0]).toContain('unknown badge "hot"');
  });

  it('gives an empty imageUrl when the product has no images', () => {
    const entry = toCatalogEntry(product({ images: [] }));
    expect(entry.images).toEqual([]);
    expect(entry.imageUrl).toBe('');
  });
});

describe('duplicateSlugs', () => {
  it('lists each slug used more than once, once', () => {
    expect(duplicateSlugs([{ slug: 'a' }, { slug: 'b' }, { slug: 'a' }, { slug: 'a' }, { slug: 'c' }])).toEqual(['a']);
  });

  it('is empty when every slug is unique', () => {
    expect(duplicateSlugs([{ slug: 'a' }, { slug: 'b' }])).toEqual([]);
  });
});
