import { readFileSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'

// public/products.json is regenerated from Stripe, so specs run on a fixed catalog instead.
const CATALOG = readFileSync(new URL('./fixtures/products.json', import.meta.url), 'utf8')

export const test = base.extend({
  // `run`, not `use`: the react-hooks lint rule reads a call to `use` as React's hook.
  page: async ({ page }, run) => {
    await page.route('**/products.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: CATALOG }),
    )
    // Google Fonts only adds fallbacks; an empty sheet keeps runs offline and free of console noise.
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ contentType: 'text/css', body: '' }),
    )
    await run(page)
  },
})

export { expect }

/** Waits until the catalog has rendered, so keyboard input never lands before hydration. */
export async function gotoReady(page, url) {
  const response = await page.goto(url)
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Loading the shop' })).toHaveCount(0)
  return response
}
