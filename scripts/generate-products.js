#!/usr/bin/env node
/**
 * Generate public/products.json from the Stripe API.
 *
 * This is an explicit, manual step — it is deliberately NOT wired to `prebuild`. Running it in
 * CI meant every build (including pull_request builds) needed STRIPE_SECRET_KEY in its
 * environment, and it rewrote a tracked file on every run so the committed catalog and the
 * deployed one drifted with no signal.
 *
 * Requires: STRIPE_SECRET_KEY
 *
 * Usage:
 *   yarn generate:products
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/generate-products.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists (for local development)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Tolerate a leading `export ` as shells write it.
    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const eq = withoutExport.indexOf('=');
    if (eq === -1) return;

    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();

    // Strip matching surrounding quotes. Without this, KEY="sk_..." yielded a key that still
    // contained the quote characters, and Stripe answered 401 with no obvious cause.
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) process.env[key] = value;
  });
}

const { STRIPE_SECRET_KEY } = process.env;

// Fail loudly. This used to exit 0 with a warning, which meant a misconfigured deploy silently
// shipped a stale catalog while reporting success — the most dangerous of the failure modes.
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not set.');
  console.error('\nFor local development:');
  console.error('  1. Create a .env.local file');
  console.error('  2. Add: STRIPE_SECRET_KEY=sk_test_your_key_here');
  console.error('\nIf you meant to build against the committed catalog, run `yarn build`');
  console.error('directly — it no longer regenerates products.json.');
  process.exit(1);
}

// Stripe API configuration
const STRIPE_API_BASE = 'api.stripe.com';
const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');

/**
 * Make an authenticated request to the Stripe API.
 *
 * Error messages carry the status code only. The raw response body used to be interpolated
 * into the thrown message and printed, which echoed Stripe payloads into public CI logs.
 */
function makeStripeRequest(requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STRIPE_API_BASE,
      path: requestPath,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse Stripe response: ${err.message}`));
          }
        } else {
          let detail = '';
          try {
            // Stripe's `message` is safe to surface; the full payload is not.
            detail = JSON.parse(data)?.error?.message ?? '';
          } catch {
            detail = '';
          }
          reject(new Error(`Stripe API error ${res.statusCode}${detail ? `: ${detail}` : ''}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch every page of a Stripe list endpoint.
 *
 * The previous single `limit=100` request silently truncated any catalog above 100 items —
 * products past the first page simply never appeared in the shop.
 */
async function fetchAllPages(basePath) {
  const results = [];
  let startingAfter = null;

  for (;;) {
    const sep = basePath.includes('?') ? '&' : '?';
    const page = startingAfter ? `${basePath}${sep}starting_after=${startingAfter}` : basePath;
    const res = await makeStripeRequest(page);
    const batch = res.data ?? [];
    results.push(...batch);

    if (!res.has_more || batch.length === 0) break;
    startingAfter = batch[batch.length - 1].id;
  }

  return results;
}

/**
 * Map a Stripe product onto our catalog shape.
 *
 * `default_price` arrives fully expanded from the list request, so no per-product price fetch
 * is needed. The old code issued one sequential /v1/prices/{id} call per product on the
 * critical path even though it had already asked for the expansion.
 */
function toCatalogEntry(product) {
  const price = product.default_price;

  if (!price || typeof price === 'string') {
    console.warn(`⚠️  Product ${product.id} has no expanded default price, skipping`);
    return null;
  }

  return {
    productId: product.id,
    name: product.name,
    description: product.description || '',
    price: price.unit_amount,          // Minor units, as Stripe reports them
    currency: price.currency.toUpperCase(),
    // Note: files.stripe.com links are account-scoped and can be rotated. ProductCard falls
    // back to /product_placeholder.svg on error.
    imageUrl: product.images?.[0] ?? '',
    active: product.active,
    stripeProductId: product.id,
    stripePriceId: price.id,
  };
}

async function generateProducts() {
  try {
    console.log('📦 Fetching products from Stripe API...');

    const products = await fetchAllPages(
      '/v1/products?active=true&limit=100&expand[]=data.default_price',
    );

    console.log(`✓ Found ${products.length} active product(s)`);

    if (products.length === 0) {
      // An empty catalog rejects every checkout as "Unknown product", so refuse to write one.
      console.error('❌ No active products found in Stripe — refusing to write an empty catalog.');
      console.error('   Create products at https://dashboard.stripe.com/products');
      process.exit(1);
    }

    const formattedProducts = products.map(toCatalogEntry).filter(Boolean);

    if (formattedProducts.length === 0) {
      console.error('❌ No products had a usable default price — refusing to write an empty catalog.');
      process.exit(1);
    }

    const currencies = new Set(formattedProducts.map(p => p.currency));
    if (currencies.size > 1) {
      // Stripe Checkout accepts a single currency per session, and the cart blocks mixing —
      // so a multi-currency catalog means some pairs of products can never be bought together.
      console.warn(`⚠️  Catalog spans multiple currencies: ${[...currencies].join(', ')}`);
      console.warn('   Customers will not be able to combine them in one checkout.');
    }

    for (const p of formattedProducts) {
      const major = (p.price / 100).toFixed(2);
      console.log(`  ✓ ${p.name} — ${p.currency} ${major}`);
    }

    const outputPath = path.join(__dirname, '..', 'public', 'products.json');
    const output = {
      products: formattedProducts,
      generated: new Date().toISOString(),
      source: 'Stripe API',
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

    console.log(`\n✅ Generated ${formattedProducts.length} product(s) → ${outputPath}`);
    console.log('   Commit the result — it is the catalog the checkout function validates against.');
    console.log('   Then run `yarn sync:catalog` before deploying the Lambda.');

  } catch (error) {
    console.error('❌ Error generating products:', error.message);
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.error('\n💡 Tip: check that STRIPE_SECRET_KEY is correct');
      console.error('   Test keys start with: sk_test_');
      console.error('   Live keys start with: sk_live_');
    }
    process.exit(1);
  }
}

generateProducts();
