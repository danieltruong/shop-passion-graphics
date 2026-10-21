import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SiteHeader from '../components/SiteHeader'
import { frog, sobble } from './fixtures'
import LocationProbe from './LocationProbe'
import { renderWithRouter } from './renderWithRouter'

function renderHeader({ route = '/', ...props } = {}) {
  return renderWithRouter(
    <>
      <SiteHeader {...props} />
      <LocationProbe />
    </>,
    { route },
  )
}

const location = () => screen.getByTestId('location').textContent
// Desktop CSS hides the menu button (jsdom never matches the mobile media query), so no role query.
const menuButton = () => screen.getByLabelText('Menu', { selector: 'button' })
// jsdom drops the space before the visually hidden " animations"; browsers keep it.
const pauseButton = () => screen.getByRole('button', { name: /^Pause ?animations$/ })

describe('SiteHeader', () => {
  describe('mobile menu', () => {
    it('controls the element holding the main nav', () => {
      renderHeader()
      const menu = document.getElementById(menuButton().getAttribute('aria-controls'))
      expect(menu).toContainElement(screen.getByRole('navigation', { name: 'Main' }))
    })

    it('toggles aria-expanded', async () => {
      const user = userEvent.setup()
      renderHeader()
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
      await user.click(menuButton())
      expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
      await user.click(menuButton())
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes on Escape', async () => {
      const user = userEvent.setup()
      renderHeader()
      await user.click(menuButton())
      await user.keyboard('{Escape}')
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes when a nav link is followed', async () => {
      const user = userEvent.setup()
      renderHeader()
      await user.click(menuButton())
      await user.click(screen.getByRole('link', { name: 'About' }))
      expect(location()).toBe('/about')
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('navigation', () => {
    it('marks the current page', () => {
      renderHeader({ route: '/faq' })
      expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Shop' })).not.toHaveAttribute('aria-current')
    })

    it('marks Shop as current on a product page', () => {
      renderHeader({ route: '/products/frog' })
      expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('aria-current', 'true')
    })
  })

  describe('pause toggle', () => {
    it('reflects the paused state in aria-pressed', () => {
      renderHeader({ animationsPaused: true })
      expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    })

    it('calls onToggleAnimations when pressed', async () => {
      const user = userEvent.setup()
      const onToggleAnimations = vi.fn()
      renderHeader({ onToggleAnimations })
      await user.click(pauseButton())
      expect(onToggleAnimations).toHaveBeenCalledTimes(1)
    })
  })

  describe('search', () => {
    const searchBox = () => screen.getByRole('searchbox', { name: 'Search products' })

    it('goes to the home page shop grid with the query', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/about' })
      await user.type(searchBox(), 'frog{Enter}')
      expect(location()).toBe('/?q=frog#shop')
    })

    it('trims the term', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/about' })
      await user.type(searchBox(), '  frog  {Enter}')
      expect(location()).toBe('/?q=frog#shop')
    })

    it('keeps the current home page filters', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/?category=Prints' })
      await user.type(searchBox(), 'frog{Enter}')
      expect(location()).toBe('/?category=Prints&q=frog#shop')
    })

    it('drops filters from other pages', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/about?category=Prints' })
      await user.type(searchBox(), 'frog{Enter}')
      expect(location()).toBe('/?q=frog#shop')
    })

    it('mirrors ?q= on the home page', () => {
      renderHeader({ route: '/?q=sobble' })
      expect(searchBox()).toHaveValue('sobble')
    })

    it('ignores ?q= on other pages', () => {
      renderHeader({ route: '/about?q=sobble' })
      expect(searchBox()).toHaveValue('')
    })

    it('clears the query when submitted empty', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/?q=frog&category=Prints' })
      await user.clear(searchBox())
      await user.type(searchBox(), '{Enter}')
      expect(location()).toBe('/?category=Prints#shop')
    })

    it('closes the menu after searching', async () => {
      const user = userEvent.setup()
      renderHeader({ route: '/?q=frog' })
      await user.click(menuButton())
      await user.type(searchBox(), '{Enter}')
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('cart button', () => {
    it('is absent when the cart is disabled', () => {
      renderHeader({ cart: [{ product: frog, quantity: 1 }] })
      expect(screen.queryByRole('button', { name: /^Cart/ })).not.toBeInTheDocument()
    })

    it('uses the singular label for one item', () => {
      renderHeader({ cartEnabled: true, cart: [{ product: frog, quantity: 1 }] })
      expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument()
    })

    it('sums quantities in the label', () => {
      renderHeader({ cartEnabled: true, cart: [{ product: frog, quantity: 2 }, { product: sobble, quantity: 3 }] })
      expect(screen.getByRole('button', { name: 'Cart, 5 items' })).toBeInTheDocument()
    })

    it('caps the visible badge at 99+', () => {
      renderHeader({ cartEnabled: true, cart: [{ product: frog, quantity: 120 }] })
      expect(screen.getByText('99+')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cart, 120 items' })).toBeInTheDocument()
    })

    it('calls onCartOpen when clicked', async () => {
      const user = userEvent.setup()
      const onCartOpen = vi.fn()
      renderHeader({ cartEnabled: true, onCartOpen })
      await user.click(screen.getByRole('button', { name: 'Cart, 0 items' }))
      expect(onCartOpen).toHaveBeenCalledTimes(1)
    })
  })
})
