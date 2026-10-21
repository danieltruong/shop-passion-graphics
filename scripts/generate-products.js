#!/usr/bin/env node
// Generate public/products.json from the Stripe API. Manual step, never `prebuild`: CI would need
// the secret key and would rewrite a tracked file. Needs STRIPE_SECRET_KEY. Run `yarn generate:products`.

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatPrice } from '../src/utils/formatPrice.js';
import { duplicateSlugs, paymentLinksByProduct, toCatalogEntry } from './lib/catalog-entry.js';

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

    // Strip matching quotes; a quoted key otherwise reaches Stripe as-is and gets a bare 401.
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) process.env[key] = value;
  });
}

const { STRIPE_SECRET_KEY } = process.env;

// Fail loudly: exiting 0 here would ship a stale catalog while reporting success.
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

// Errors carry the status and Stripe's `message` only; full payloads must not reach logs.
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
          let detail;
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

/** Fetch every page of a Stripe list endpoint; one `limit=100` page would truncate the catalog. */
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

    // line_items is not returned unless expanded; each item's price comes embedded with it.
    console.log('🔗 Fetching Payment Links from Stripe...');
    const links = await fetchAllPages('/v1/payment_links?active=true&limit=100&expand[]=data.line_items');
    console.log(`✓ Found ${links.length} active Payment Link(s)`);
    const linksByProduct = paymentLinksByProduct(links);

    const formattedProducts = products.map((p) => toCatalogEntry(p, linksByProduct)).filter(Boolean);

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

    const dupes = duplicateSlugs(formattedProducts);
    if (dupes.length > 0) {
      console.error(`❌ Duplicate slugs: ${dupes.join(', ')}. Set a unique metadata.slug on each product.`);
      process.exit(1);
    }

    for (const p of formattedProducts) {
      const link = p.paymentLink ? 'Payment Link' : 'no Payment Link';
      console.log(`  ✓ ${p.name} — ${formatPrice(p.price, p.currency)} — /products/${p.slug} — ${link}`);
    }

    const missingLinks = formattedProducts.filter((p) => !p.paymentLink);
    if (missingLinks.length > 0) {
      console.warn(`⚠️  ${missingLinks.length} product(s) have no Payment Link and show "Coming soon".`);
      console.warn('   Create them at https://dashboard.stripe.com/payment-links');
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
