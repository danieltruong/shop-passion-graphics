import { CART_ENABLED } from '../src/features.js'
import { test, expect, gotoReady } from './fixtures.js'

/**
 * Accessibility behaviour that jsdom cannot verify: real focus, layout, computed styles and
 * media emulation. Catalog comes from e2e/fixtures/products.json via ./fixtures.js.
 */

const playState = (locator) => locator.evaluate((el) => getComputedStyle(el).animationPlayState)

// Registered only while the cart ships, so Phase 1 runs report no skipped tests.
const cartDescribe = CART_ENABLED ? test.describe : () => {}

cartDescribe('cart drawer (Phase 2)', () => {
  test('no dialog is exposed while the cart is closed', async ({ page }) => {
    await gotoReady(page, '/')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('keyboard never reaches drawer controls while closed', async ({ page }) => {
    await gotoReady(page, '/')

    const seen = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      seen.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''))
    }

    expect(seen.join(' | ')).not.toMatch(/close cart|checkout via stripe|clear cart|quantity of/i)
  })

  test('opening the cart moves focus into the dialog', async ({ page }) => {
    await gotoReady(page, '/')
    await page.getByRole('button', { name: /^cart,/i }).click()

    const dialog = page.getByRole('dialog', { name: /your cart/i })
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeFocused()
  })

  test('Tab is trapped inside the open dialog', async ({ page }) => {
    await gotoReady(page, '/')
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.getByRole('button', { name: 'Cart, 1 item' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]')
        return !!d && d.contains(document.activeElement)
      })
      expect(inside, `focus escaped the dialog on Tab #${i + 1}`).toBe(true)
    }
  })

  test.describe('focus stays in the dialog when lines go', () => {
    // Chromium puts a space before the visually hidden ": Frog"; jsdom does not.
    const addButton = (page, name) => page.getByRole('button', { name: new RegExp(`^Add to cart ?: ${name}$`) })

    async function openCartWith(page, names, label) {
      await gotoReady(page, '/')
      for (const name of names) await addButton(page, name).click()
      await page.getByRole('button', { name: label }).click()
      return page.getByRole('dialog', { name: /your cart/i })
    }

    test('Remove moves focus to the next line', async ({ page }) => {
      const dialog = await openCartWith(page, ['Frog', 'Moth Pin'], 'Cart, 2 items')
      await dialog.getByRole('button', { name: 'Remove Frog from cart' }).press('Enter')
      await expect(dialog.getByRole('button', { name: 'Decrease quantity of Moth Pin' })).toBeFocused()
    })

    test('Remove moves focus to the previous line when the last line goes', async ({ page }) => {
      const dialog = await openCartWith(page, ['Frog', 'Moth Pin'], 'Cart, 2 items')
      await dialog.getByRole('button', { name: 'Remove Moth Pin from cart' }).press('Enter')
      await expect(dialog.getByRole('button', { name: 'Decrease quantity of Frog' })).toBeFocused()
    })

    test('Remove on the only line focuses the dialog', async ({ page }) => {
      const dialog = await openCartWith(page, ['Frog'], 'Cart, 1 item')
      await dialog.getByRole('button', { name: 'Remove Frog from cart' }).press('Enter')
      await expect(dialog.getByText('Your cart is empty')).toBeVisible()
      await expect(dialog).toBeFocused()
    })

    test('Decrease at quantity 1 keeps its name, removes the line and focuses the dialog', async ({ page }) => {
      const dialog = await openCartWith(page, ['Frog'], 'Cart, 1 item')
      await dialog.getByRole('button', { name: 'Decrease quantity of Frog' }).press('Enter')
      await expect(dialog.getByText('Your cart is empty')).toBeVisible()
      await expect(dialog).toBeFocused()
    })

    test('Clear cart focuses the dialog', async ({ page }) => {
      const dialog = await openCartWith(page, ['Frog', 'Moth Pin'], 'Cart, 2 items')
      await dialog.getByRole('button', { name: 'Clear cart' }).press('Enter')
      await expect(dialog.getByText('Your cart is empty')).toBeVisible()
      await expect(dialog).toBeFocused()
    })

    test('a refused add opens the drawer and Escape returns focus to that Add button', async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem('spg.cart.v1', JSON.stringify([{ key: 'price_e2e_frog', quantity: 99 }])),
      )
      await gotoReady(page, '/')
      const add = addButton(page, 'Frog')
      await add.click()
      await expect(page.getByRole('dialog', { name: /your cart/i }).getByRole('alert')).toHaveText('Maximum 99 per item.')

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(add).toBeFocused()
    })
  })

  test('Escape closes the drawer and returns focus to the cart button', async ({ page }) => {
    await gotoReady(page, '/')
    const cartButton = page.getByRole('button', { name: /^cart,/i })
    await cartButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(cartButton).toBeFocused()
  })
})

test.describe('skip link and focus on navigation', () => {
  test('first Tab shows the skip link and Enter focuses main', async ({ page }) => {
    await gotoReady(page, '/')
    await page.keyboard.press('Tab')

    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()

    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('clicking a nav link moves focus to main @desktop', async ({ page }) => {
    await gotoReady(page, '/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'About' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'About the shop' })).toBeVisible()
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('footer hash link scrolls its target into view', async ({ page }) => {
    await gotoReady(page, '/')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Custom orders' }).click()

    await expect(page).toHaveURL(/\/faq#products$/)
    await expect(page.locator('#products')).toBeInViewport()
    await expect(page.locator('#main-content')).toBeFocused()
  })
})

test.describe('mobile menu @mobile', () => {
  test('Menu button reports its state through aria-expanded', async ({ page }) => {
    await gotoReady(page, '/')
    const menu = page.getByRole('button', { name: 'Menu' })
    const nav = page.getByRole('navigation', { name: 'Main' })

    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()

    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await expect(nav).toBeVisible()
  })

  test('Escape closes the menu and returns focus to the Menu button', async ({ page }) => {
    await gotoReady(page, '/')
    const menu = page.getByRole('button', { name: 'Menu' })
    await menu.click()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'FAQ' }).focus()

    await page.keyboard.press('Escape')
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
    await expect(menu).toBeFocused()
  })

  test('choosing a link closes the menu and focuses main', async ({ page }) => {
    await gotoReady(page, '/')
    const menu = page.getByRole('button', { name: 'Menu' })
    await menu.click()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'FAQ' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeVisible()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
    await expect(page.locator('#main-content')).toBeFocused()
  })
})

test.describe('product gallery', () => {
  test('thumbnails mark the shown photo with aria-pressed', async ({ page }) => {
    await gotoReady(page, '/products/frog')
    const first = page.getByRole('button', { name: 'Show photo 1' })
    const second = page.getByRole('button', { name: 'Show photo 2' })

    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(second).toHaveAttribute('aria-pressed', 'false')

    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.gallery__main img')).toHaveAttribute('alt', 'Frog photo 2')
  })

  test('every thumbnail is at least 44px on both axes', async ({ page }) => {
    await gotoReady(page, '/products/frog')
    const thumbs = page.locator('.gallery__thumb')
    await expect(thumbs).toHaveCount(3)

    const smallest = await thumbs.evaluateAll((els) =>
      Math.min(...els.flatMap((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])),
    )
    expect(smallest).toBeGreaterThanOrEqual(44)
  })
})

test.describe('pause animations (WCAG 2.2.2)', () => {
  test('toggle keeps its name and flips aria-pressed', async ({ page }) => {
    await gotoReady(page, '/')
    const toggle = page.locator('.pause-toggle')

    await expect(toggle).toHaveAccessibleName('Pause animations')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName('Pause animations')
  })

  test('pressing it swaps the scrolling track for the short line @desktop', async ({ page }) => {
    await gotoReady(page, '/')
    const track = page.locator('.spg-marquee__track')
    const short = page.locator('.spg-marquee__short')
    await expect(track).toBeVisible()
    await expect(short).toBeHidden()

    await page.locator('.pause-toggle').click()
    await expect(track).toBeHidden()
    await expect(short).toBeVisible()
  })

  test('pressing it pauses the rainbow and starfield loops', async ({ page }) => {
    await gotoReady(page, '/')
    const rainbow = page.locator('.rainbow-text').first()
    const stars = page.locator('.starfield__stars').first()
    expect(await playState(rainbow)).toBe('running')
    expect(await playState(stars)).toBe('running')

    await page.locator('.pause-toggle').click()
    await expect(page.locator('[data-animations-paused]')).toHaveCount(1)
    expect(await playState(rainbow)).toBe('paused')
    expect(await playState(stars)).toBe('paused')
  })

  test('the marquee scrolls when motion is allowed @desktop', async ({ page }) => {
    await gotoReady(page, '/')
    const track = page.locator('.spg-marquee__track')
    await expect(track).toBeVisible()
    expect(await track.evaluate((el) => getComputedStyle(el).animationName)).toBe('marquee')
  })
})

test.describe('prefers-reduced-motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('home page runs no animations once loaded', async ({ page }) => {
    await gotoReady(page, '/')
    // One-shot 0.01ms animations may still be finishing; wait for them rather than sleeping.
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
  })

  test('the short marquee line replaces the scrolling track @desktop', async ({ page }) => {
    await gotoReady(page, '/')
    await expect(page.locator('.spg-marquee__track')).toBeHidden()
    await expect(page.locator('.spg-marquee__short')).toBeVisible()
  })

  test('starfield layers do not move with scroll', async ({ page }) => {
    await gotoReady(page, '/')
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500)

    const transforms = await page
      .locator('.starfield__layer')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform))
    expect(transforms).toEqual(['none', 'none', 'none'])
  })
})

test('forced colors hide the starfield', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await gotoReady(page, '/')
  await expect(page.locator('.starfield')).toBeHidden()
})

test.describe('rendering', () => {
  test('product cards resolve to fully opaque after scrolling into view', async ({ page }) => {
    // Playwright counts an opacity-0 box as visible, so read opacity directly.
    await gotoReady(page, '/')
    const card = page.locator('.shop-card').first()
    await card.scrollIntoViewIfNeeded()
    await expect
      .poll(() => card.evaluate((el) => parseFloat(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.9)
  })

  test('prices read as "$25.00 CAD" with no "CAD $"', async ({ page }) => {
    await gotoReady(page, '/')
    const frog = page.locator('.shop-card').filter({ has: page.getByRole('link', { name: 'Frog' }) })
    await expect(frog.locator('.price-sticker')).toHaveText('$25.00 CAD')
  })
})
