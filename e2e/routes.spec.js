import { test, expect, gotoReady } from './fixtures.js'

const SITE = 'shop.passion.graphics'

const PAGES = [
  { path: '/', h1: 'graphic design is my passion', title: SITE },
  { path: '/products/frog', h1: 'Frog', title: `Frog | ${SITE}` },
  { path: '/about', h1: 'About the shop', title: `About the shop | ${SITE}` },
  { path: '/faq', h1: 'Frequently asked questions', title: `Frequently asked questions | ${SITE}` },
  { path: '/shipping', h1: 'Shipping & returns', title: `Shipping & returns | ${SITE}` },
  { path: '/success', h1: 'Thank you!', title: `Thank you | ${SITE}` },
  { path: '/privacy', h1: 'Privacy policy', title: `Privacy policy | ${SITE}` },
  { path: '/products/no-such-thing', h1: 'Page not found', title: `Page not found | ${SITE}` },
  { path: '/no-such-page', h1: 'Page not found', title: `Page not found | ${SITE}` },
]

const shopCards = (page) => page.locator('#shop .shop-card')
const cardNames = (page) => page.locator('#shop .shop-card__name')

// IntersectionObserver delivers during a rendering update, so two frames see its callback land.
const nextFrames = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

test.describe('every route', () => {
  for (const { path, h1, title } of PAGES) {
    test(`${path} has its h1 and title`, async ({ page }) => {
      await gotoReady(page, path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
      await expect(page).toHaveTitle(title)
    })

    test(`${path} logs no console errors`, async ({ page }) => {
      const messages = []
      page.on('console', (msg) => messages.push({ type: msg.type(), text: msg.text() }))
      page.on('pageerror', (err) => messages.push({ type: 'error', text: err.message }))
      await gotoReady(page, path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
      expect(messages.filter((m) => m.type === 'error').map((m) => m.text)).toEqual([])
    })

    test(`${path} does not scroll sideways at 390px @mobile`, async ({ page }) => {
      await gotoReady(page, path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBe(0)
    })
  }
})

test.describe('product page', () => {
  test('a deep link is served by the SPA fallback', async ({ page }) => {
    const response = await gotoReady(page, '/products/frog')
    expect(response.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Frog')
  })

  test('"Add to cart" adds the product without opening the drawer', async ({ page }) => {
    await gotoReady(page, '/products/frog')
    await page.locator('.product__info').getByRole('button', { name: 'Add to cart', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Added Frog to cart. Cart has 1 item.' })).toBeAttached()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('a sold-out product offers "Email me when it\'s back" instead of buying', async ({ page }) => {
    await gotoReady(page, '/products/sobble-cart')
    const info = page.locator('.product__info')
    await expect(info.getByRole('link', { name: "Email me when it's back" })).toBeVisible()
    await expect(info.getByRole('link', { name: 'Buy now' })).toHaveCount(0)
  })
})

test.describe('search', () => {
  test('header search filters the grid and Clear search drops q @desktop', async ({ page }) => {
    await gotoReady(page, '/about')
    await page.getByRole('searchbox', { name: 'Search products' }).fill('frog')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/\?q=frog#shop$/)
    await expect(page.getByText('Results for')).toBeVisible()
    await expect(cardNames(page)).toHaveText(['Frog'])

    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(shopCards(page)).toHaveCount(4)
  })

  test('search from the mobile menu lands on the results @mobile', async ({ page }) => {
    await gotoReady(page, '/about')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('searchbox', { name: 'Search products' }).fill('frog')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/\?q=frog#shop$/)
    await expect(page.getByText('Results for')).toBeVisible()
    await expect(cardNames(page)).toHaveText(['Frog'])
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('filters', () => {
  test('category chip and sort live in the URL and survive Back from a product', async ({ page }) => {
    await gotoReady(page, '/')
    const chips = page.getByRole('group', { name: 'Filter by category' })
    await chips.getByRole('button', { name: 'Plush' }).click()
    await page.getByLabel('Sort:').selectOption('price-desc')

    await expect(page).toHaveURL(/category=Plush/)
    await expect(page).toHaveURL(/sort=price-desc/)
    await expect(cardNames(page)).toHaveText(['Toad Plush', 'Frog'])

    await page.getByRole('link', { name: 'Toad Plush', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toad Plush')
    await page.goBack()

    await expect(page).toHaveURL(/category=Plush/)
    await expect(page).toHaveURL(/sort=price-desc/)
    await expect(chips.getByRole('button', { name: 'Plush' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Sort:')).toHaveValue('price-desc')
    await expect(cardNames(page)).toHaveText(['Toad Plush', 'Frog'])
  })

  test('?badge=new shows only new items with a "New arrivals" clear control', async ({ page }) => {
    await gotoReady(page, '/?badge=new#shop')
    await expect(cardNames(page)).toHaveText(['Frog'])

    await page.getByRole('button', { name: 'New arrivals, clear filter', exact: true }).click()
    await expect(page).not.toHaveURL(/badge=/)
    await expect(shopCards(page)).toHaveCount(4)
  })
})

test.describe('mobile buy bar @mobile', () => {
  test('appears only after the main CTA scrolls out of view', async ({ page }) => {
    await gotoReady(page, '/products/frog')
    const bar = page.locator('.product-bar')
    await expect(page.locator('.product__cta-wrap')).toBeAttached()
    await nextFrames(page)
    await expect(bar).toHaveCount(0)

    // A jump straight past the CTA, which never intersects on the way.
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    )

    await expect(bar).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Add to cart' })).toBeVisible()
    const padding = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom)
    expect(parseFloat(padding)).toBeGreaterThanOrEqual(100)

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(bar).toHaveCount(0)
  })
})

test.describe('shipping table @mobile', () => {
  test('stacks into labelled rows at 390px and keeps its caption', async ({ page }) => {
    await gotoReady(page, '/shipping')
    const table = page.getByRole('table')
    await expect(table.locator('caption')).toHaveText('Shipping rates')

    const firstCell = table.getByRole('cell').first()
    await expect(firstCell).toHaveAttribute('data-label', 'Destination')
    await expect(firstCell).toHaveCSS('display', 'block')
    const label = await firstCell.evaluate((el) => getComputedStyle(el, '::before').content)
    expect(label).toContain('Destination')
  })
})
