#!/usr/bin/env node
/**
 * Copy the product catalog into the Lambda source directory so it ships inside the
 * function bundle.
 *
 * The checkout handler validates every submitted price ID against this catalog. It cannot read
 * public/products.json at runtime because infra/template.yaml sets
 * `CodeUri: ../lambda/create-checkout/` and SAM packages only that directory.
 *
 * Run before `sam build`. The copy is gitignored — public/products.json stays the one source
 * of truth.
 */

import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../public/products.json', import.meta.url))
const DEST = fileURLToPath(new URL('../lambda/create-checkout/products.json', import.meta.url))

const { products } = JSON.parse(await readFile(SRC, 'utf8'))

if (!Array.isArray(products) || products.length === 0) {
  console.error('❌ public/products.json has no products — refusing to ship an empty catalog.')
  console.error('   Every checkout would be rejected as "Unknown product".')
  process.exit(1)
}

const sellable = products.filter((p) => p.active !== false && p.stripePriceId)
if (sellable.length === 0) {
  console.error('❌ No active products with a stripePriceId — refusing to ship an empty catalog.')
  process.exit(1)
}

await copyFile(SRC, DEST)
console.log(`✅ Catalog synced to Lambda — ${sellable.length} sellable price(s).`)
