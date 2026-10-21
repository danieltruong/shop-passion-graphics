// Pure mapping from Stripe API objects to public/products.json entries, kept apart from
// generate-products.js so it can be tested without network access.

import { imageList, isStripePaymentLink, normalizeBadge, slugFor } from '../../src/utils/catalog.js';

const idOf = (ref) => (typeof ref === 'string' ? ref : ref?.id ?? null);

const redirectsToSuccess = (link) => {
  try {
    return new URL(link.after_completion?.redirect?.url).pathname.endsWith('/success');
  } catch {
    return false;
  }
};

/**
 * Map product ID -> [{ url, priceId }] from Payment Links listed with `expand[]=data.line_items`.
 * A Payment Link buys one product here, so links with several line items are skipped.
 */
export function paymentLinksByProduct(links) {
  const byProduct = new Map();

  for (const link of links) {
    const items = link.line_items?.data ?? [];
    if (items.length !== 1 || link.line_items?.has_more) {
      console.warn(`⚠️  Payment Link ${link.id} has ${items.length}${link.line_items?.has_more ? '+' : ''} line items, skipping`);
      continue;
    }
    if (!isStripePaymentLink(link.url)) {
      console.warn(`⚠️  Payment Link ${link.id} URL is not on buy.stripe.com, skipping`);
      continue;
    }

    const price = items[0].price;
    const productId = idOf(price?.product);
    if (!productId) {
      console.warn(`⚠️  Payment Link ${link.id} has no product on its line item, skipping`);
      continue;
    }
    if (!redirectsToSuccess(link)) {
      console.warn(`⚠️  Payment Link ${link.id} does not redirect to /success after payment; set it in Stripe`);
    }
    const list = byProduct.get(productId) ?? [];
    list.push({ url: link.url, priceId: idOf(price) });
    byProduct.set(productId, list);
  }

  return byProduct;
}

/**
 * Map a Stripe product, listed with `expand[]=data.default_price`, onto a catalog entry.
 * Returns null when the product has no usable price.
 */
export function toCatalogEntry(product, linksByProduct = new Map()) {
  const price = product.default_price;
  if (!price || typeof price === 'string') {
    console.warn(`⚠️  Product ${product.id} has no expanded default price, skipping`);
    return null;
  }

  const meta = product.metadata ?? {};
  const rawBadge = (meta.badge ?? '').trim();
  const badge = normalizeBadge(rawBadge);
  if (rawBadge && !badge) {
    console.warn(`⚠️  Product ${product.id} has unknown badge "${rawBadge}" (use new or sold_out), ignoring`);
  }

  // A link charging another price would show one amount and bill a different one.
  const links = linksByProduct.get(product.id) ?? [];
  const matching = links.filter((l) => l.priceId === price.id);
  if (links.length > matching.length) {
    console.warn(`⚠️  Product ${product.id} has Payment Link(s) not on default price ${price.id}, skipping them`);
  }
  if (matching.length > 1) {
    console.warn(`⚠️  Product ${product.id} has ${matching.length} Payment Links on its default price, keeping ${matching[0].url}`);
  }
  const paymentLink = matching[0]?.url ?? null;

  // files.stripe.com links are account-scoped and can rotate; the UI falls back to a placeholder.
  const images = imageList(product.images);

  return {
    productId: product.id,
    name: product.name,
    description: product.description || '',
    price: price.unit_amount,
    currency: price.currency.toUpperCase(),
    imageUrl: images[0] ?? '',
    images,
    slug: slugFor(meta.slug, product.name, product.id),
    category: meta.category?.trim() || null,
    badge,
    paymentLink,
    active: product.active,
    stripeProductId: product.id,
    stripePriceId: price.id,
  };
}

/** Slugs used by more than one entry; product pages are looked up by slug. */
export function duplicateSlugs(entries) {
  const seen = new Set();
  const dupes = new Set();
  for (const { slug } of entries) {
    if (seen.has(slug)) dupes.add(slug);
    seen.add(slug);
  }
  return [...dupes];
}
