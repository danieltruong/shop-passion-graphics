#!/usr/bin/env node
/**
 * Generate products.json from Stripe API at build time
 * 
 * Fetches active products from Stripe and generates public/products.json
 * Requires: STRIPE_SECRET_KEY environment variable
 * 
 * Usage:
 *   npm run generate:products
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
    // Skip comments and empty lines
    if (line.trim() && !line.trim().startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  });
}

const { STRIPE_SECRET_KEY } = process.env;

// Validate environment
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set — skipping product sync, using existing products.json');
  console.warn('\nFor local development:');
  console.warn('  1. Create .env.local file');
  console.warn('  2. Add: STRIPE_SECRET_KEY=sk_test_your_key_here');
  console.warn('\nFor CI/CD:');
  console.warn('  1. Add STRIPE_SECRET_KEY to GitHub Secrets');
  console.warn('  2. See: https://github.com/settings/secrets/actions');
  process.exit(0);
}

// Stripe API configuration
const STRIPE_API_BASE = 'api.stripe.com';
const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');

/**
 * Make authenticated request to Stripe API
 */
function makeStripeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STRIPE_API_BASE,
      path,
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
          reject(new Error(`Stripe API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch all Payment Links from Stripe
 */
async function fetchPaymentLinks() {
  try {
    console.log('🔗 Fetching Payment Links from Stripe...');
    // Expand line_items.data.price to get product information
    const paymentLinksRes = await makeStripeRequest('/v1/payment_links?active=true&limit=100&expand[]=data.line_items.data.price');
    const paymentLinks = paymentLinksRes.data || [];
    
    console.log(`  Found ${paymentLinks.length} Payment Link(s)`);
    
    // Create a map of product ID -> payment link URL
    const linksByProduct = {};
    paymentLinks.forEach(link => {
      // Payment Links have line_items with prices that reference products
      if (link.line_items && link.line_items.data && link.line_items.data.length > 0) {
        const firstItem = link.line_items.data[0];
        if (firstItem.price && firstItem.price.product) {
          const productId = firstItem.price.product;
          linksByProduct[productId] = link.url;
          console.log(`  ✓ Matched Payment Link → ${productId}`);
        }
      }
    });
    
    return linksByProduct;
  } catch (error) {
    console.warn('⚠️  Failed to fetch Payment Links:', error.message);
    console.warn('   Payment Links must be created manually in Stripe Dashboard');
    return {};
  }
}

/**
 * Fetch product details including price
 */
async function fetchProductWithPrice(product, paymentLinksMap) {
  try {
    // If product has a default_price, fetch it
    if (product.default_price) {
      const priceId = typeof product.default_price === 'string' 
        ? product.default_price 
        : product.default_price.id;
      
      const price = await makeStripeRequest(`/v1/prices/${priceId}`);
      
      // Get payment link from map if available
      const paymentLink = paymentLinksMap[product.id] || null;
      
      return {
        productId: product.id,
        name: product.name,
        description: product.description || '',
        price: price.unit_amount, // Amount in cents
        currency: price.currency.toUpperCase(),
        imageUrl: product.images && product.images.length > 0 
          ? product.images[0] 
          : '/product_placeholder.webp',
        active: product.active,
        stripeProductId: product.id,
        stripePriceId: priceId,
        paymentLink: paymentLink // Single link with adjustable quantity
      };
    } else {
      console.warn(`⚠️  Product ${product.id} has no default price, skipping`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching price for product ${product.id}:`, error.message);
    return null;
  }
}

/**
 * Main function to generate products.json
 */
async function generateProducts() {
  try {
    console.log('📦 Fetching products from Stripe API...');
    
    // Fetch all active products with expanded default_price
    const productsRes = await makeStripeRequest('/v1/products?active=true&limit=100&expand[]=data.default_price');
    const products = productsRes.data || [];

    if (products.length === 0) {
      console.warn('⚠️  Warning: No active products found in Stripe');
      console.warn('   Create products in Stripe Dashboard: https://dashboard.stripe.com/products');
    }

    console.log(`✓ Found ${products.length} active product(s)`);

    // Fetch Payment Links
    const paymentLinksMap = await fetchPaymentLinks();

    // Transform products with price information
    const formattedProducts = [];
    for (const product of products) {
      const formatted = await fetchProductWithPrice(product, paymentLinksMap);
      if (formatted) {
        formattedProducts.push(formatted);
        const linkStatus = formatted.paymentLink ? '✓' : '✗';
        console.log(`  ${linkStatus} ${formatted.name} - ${formatted.currency} ${(formatted.price / 100).toFixed(2)}`);
      }
    }

    // Write output
    const outputPath = path.join(__dirname, '..', 'public', 'products.json');
    const output = { 
      products: formattedProducts,
      generated: new Date().toISOString(),
      source: 'Stripe API'
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Generated ${formattedProducts.length} product(s) → ${outputPath}`);
    
    const missingLinks = formattedProducts.filter(p => !p.paymentLink);
    if (missingLinks.length > 0) {
      console.log('\n⚠️  Missing Payment Links for:');
      missingLinks.forEach(p => console.log(`   - ${p.name}`));
      console.log('   Create Payment Links in Stripe Dashboard: https://dashboard.stripe.com/payment-links');
    } else {
      console.log('\n✓ All products have Payment Links configured!');
    }

  } catch (error) {
    console.error('❌ Error generating products:', error.message);
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.error('\n💡 Tip: Check that your STRIPE_SECRET_KEY is correct');
      console.error('   Test keys start with: sk_test_');
      console.error('   Live keys start with: sk_live_');
    }
    process.exit(1);
  }
}

// Run the script
generateProducts();
