import { test, expect } from '@playwright/test'

/**
 * Accessibility behaviour that jsdom cannot verify.
 *
 * Every assertion here maps to a finding in docs/AUDIT.md that was fixed but marked as
 * needing manual browser confirmation. jsdom has no layout engine and no real focus model,
 * so the vitest suite can prove the markup is right but not that the *behaviour* is.
 */

test.describe('cart drawer — A11Y-01, A11Y-02', () => {
  test('no dialog is exposed while the cart is closed', async ({ page }) => {
    // A11Y-01: the drawer used to render aria-modal="true" unconditionally, so assistive
    // tech was told a modal was open on every page load.
    await page.goto('/')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('keyboard never reaches drawer controls while closed', async ({ page }) => {
    // The real A11Y-01 symptom: the panel was only translated off-screen, so tabbing past
    // the footer landed on the Close button and focus visibly vanished.
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const seen = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const label = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        return el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? el.tagName
      })
      if (label) seen.push(label)
    }

    expect(seen.join(' | ')).not.toMatch(/close cart|checkout via stripe|clear cart|quantity of/i)
  })

  test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
    // A11Y-12: id="main-content" tabIndex={-1} existed with no skip link pointing at it.
    await page.goto('/')
    // Wait for React to render before pressing Tab. Without this the keypress can land
    // pre-hydration, focus nothing, and fail intermittently under parallel execution.
    await expect(page.locator('#main-content')).toBeAttached()
    await page.keyboard.press('Tab')

    const skip = page.getByRole('link', { name: /skip to main content/i })
    await expect(skip).toBeFocused()
    // Visible only on focus — verifies the CSS actually reveals it, not just that it exists.
    await expect(skip).toBeInViewport()

    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('opening the cart moves focus into the dialog', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /shopping cart/i }).click()

    const dialog = page.getByRole('dialog', { name: 'Shopping cart' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeFocused()
  })

  test('Tab is trapped inside the open dialog', async ({ page }) => {
    // A11Y-02: focus previously walked straight out of the "modal" into the page behind it.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /add to cart/i }).first().click()
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

  test('Escape closes the drawer and returns focus to the cart button', async ({ page }) => {
    // A11Y-02: focus used to land on <body>, so the next Tab restarted at the top of the page.
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const cartButton = page.getByRole('button', { name: /shopping cart/i })
    await cartButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(cartButton).toBeFocused()
  })
})

test.describe('reduced motion — A11Y-06, A11Y-07, A11Y-08', () => {
  test('marquee and blink respect the OS preference', async ({ page }, testInfo) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const reduced = testInfo.project.name.includes('reduced-motion')

    // Guard: assert the emulation is actually in effect before trusting anything below.
    // Without this the reduced-motion project can silently run against un-reduced styles
    // and still pass — which is exactly what happened when `reducedMotion` was set at the
    // top level of `use` instead of inside `contextOptions` (see playwright.config.js).
    const matches = await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
    expect(matches, `prefers-reduced-motion emulation not applied in "${testInfo.project.name}"`)
      .toBe(reduced)

    const state = await page.evaluate(() => {
      const read = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const s = getComputedStyle(el)
        return { animationName: s.animationName, duration: s.animationDuration }
      }
      return { marquee: read('.hero-marquee span'), blink: read('.blink') }
    })

    expect(state.marquee, '.hero-marquee span not found').not.toBeNull()

    if (reduced) {
      // theme.css collapses animation-duration to 0.01ms under prefers-reduced-motion.
      expect(parseFloat(state.marquee.duration)).toBeLessThan(1)
      if (state.blink) {
        expect(
          state.blink.animationName === 'none' || parseFloat(state.blink.duration) < 1,
        ).toBe(true)
      }
    } else {
      expect(state.marquee.animationName).toBe('marquee')
      expect(parseFloat(state.marquee.duration)).toBeGreaterThan(1)
    }
  })

  test('marquee has a working pause control (WCAG 2.2.2)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Located by class, not accessible name — the name intentionally flips
    // "Pause scrolling banner" → "Resume scrolling banner" when toggled.
    const toggle = page.locator('.marquee-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAccessibleName(/pause scrolling banner/i)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName(/resume scrolling banner/i)

    // The actual requirement: motion stops, not merely that a button toggled.
    const playState = await page.evaluate(
      () => getComputedStyle(document.querySelector('.hero-marquee span')).animationPlayState,
    )
    expect(playState).toBe('paused')
  })
})

test.describe('rendering — TEST-01', () => {
  test('product grid is actually visible, not stuck at opacity 0', async ({ page }) => {
    // The old IntersectionObserver stub never fired its callback, so whileInView elements
    // stayed in the `hidden` variant. Tests passed anyway. This is the check that would
    // have caught a regression blanking the entire shop.
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const card = page.locator('.product-card').first()
    await expect(card).toBeVisible()

    // The grid sits below the fold, and the cards enter via `whileInView` — so they are
    // legitimately at opacity 0 until scrolled to. Scroll first, then assert they actually
    // resolve to visible. Note toBeVisible() alone would NOT catch this: Playwright treats
    // an opacity-0 element with a bounding box as visible, which is exactly how the old
    // no-op IntersectionObserver stub went unnoticed in vitest.
    await card.scrollIntoViewIfNeeded()
    await expect
      .poll(
        () => card.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
        { message: 'product card never animated in after scrolling into view', timeout: 5000 },
      )
      .toBeGreaterThan(0.9)
  })

  test('prices render in the catalog currency with no stray dollar sign', async ({ page }) => {
    // FE-01: the live CAD catalog used to render "CAD $100.00".
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const price = await page.locator('.product-price').first().textContent()
    expect(price).not.toMatch(/CAD\s*\$/)
    expect(price).toMatch(/\d/)
  })
})
