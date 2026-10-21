import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import ProductPage from '../pages/ProductPage'
import { frog, sobble, soldOut, unpriced } from './fixtures'
import { renderWithRouter } from './renderWithRouter'

function renderProduct(slug, props = {}) {
  return renderWithRouter(
    <Routes>
      <Route path="/products/:slug" element={<ProductPage products={[frog, sobble, soldOut, unpriced]} {...props} />} />
    </Routes>,
    { route: `/products/${slug}` },
  )
}

const pageHeading = () => screen.getByRole('heading', { level: 1 })

describe('ProductPage', () => {
  describe('lookup', () => {
    it('shows the product for its slug and sets the title', () => {
      renderProduct('frog')
      expect(pageHeading()).toHaveTextContent('Frog')
      expect(document.title).toBe('Frog | shop.passion.graphics')
    })

    it('matches the slug case-insensitively', () => {
      renderProduct('Frog')
      expect(pageHeading()).toHaveTextContent('Frog')
    })

    it('shows Page not found for an unknown slug', () => {
      renderProduct('nope')
      expect(pageHeading()).toHaveTextContent('Page not found')
      expect(document.title).toBe('Page not found | shop.passion.graphics')
    })

    it('shows a loading heading while the catalog loads', () => {
      renderProduct('frog', { products: [], loading: true })
      expect(pageHeading()).toHaveTextContent('Loading product')
    })

    it('shows Shop unavailable after a load error', () => {
      renderProduct('frog', { products: [], loadError: 'boom' })
      expect(pageHeading()).toHaveTextContent('Shop unavailable')
      expect(document.title).toBe('Shop unavailable | shop.passion.graphics')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  describe('buying', () => {
    it('links Buy now to the Payment Link', () => {
      renderProduct('frog')
      expect(screen.getByRole('link', { name: 'Buy now' })).toHaveAttribute('href', 'https://buy.stripe.com/test_frog')
    })

    it('shows the in-stock line for a product with a Payment Link', () => {
      renderProduct('frog')
      expect(screen.getByText('In stock, ships in 3–5 business days')).toBeInTheDocument()
    })

    it('shows a disabled Coming soon and no stock line without a Payment Link', () => {
      renderProduct('mystery-item')
      expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled()
      expect(screen.queryByText(/In stock/)).not.toBeInTheDocument()
    })

    it('offers an email link instead of Buy now when sold out', () => {
      renderProduct('old-frog')
      expect(screen.getByRole('link', { name: "Email me when it's back" })).toHaveAttribute('href', 'mailto:[email]')
      expect(screen.queryByRole('link', { name: 'Buy now' })).not.toBeInTheDocument()
      expect(screen.getByText('Sold out')).toBeInTheDocument()
      expect(screen.queryByText(/In stock/)).not.toBeInTheDocument()
    })

    it('offers Add to cart with the in-stock line when a cart is wired', async () => {
      const user = userEvent.setup()
      const onAddToCart = vi.fn()
      renderProduct('frog', { products: [frog], onAddToCart })
      expect(screen.getByText('In stock, ships in 3–5 business days')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Buy now' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Add to cart' }))
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ name: 'Frog' }), expect.anything())
    })

    it('shows Coming soon and no stock line with a cart but no Stripe price', () => {
      renderProduct('frog', { products: [{ ...frog, stripePriceId: null }], onAddToCart: vi.fn() })
      expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled()
      expect(screen.queryByText(/In stock/)).not.toBeInTheDocument()
    })

    it('lets related products be added to the cart', async () => {
      const user = userEvent.setup()
      const onAddToCart = vi.fn()
      renderProduct('frog', { onAddToCart })
      await user.click(screen.getByRole('button', { name: 'Add to cart: Sobble Cart' }))
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sobble Cart' }), expect.anything())
    })

    it('shows the price in the catalog currency', () => {
      renderProduct('mystery-item')
      expect(screen.getByText('$5.00 CAD')).toBeInTheDocument()
    })
  })

  describe('mobile buy bar', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function stubCtaScrolledPast() {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback) {
            this.callback = callback
          }
          observe() {
            queueMicrotask(() => this.callback([{ isIntersecting: false }]))
          }
          disconnect() {}
        },
      )
    }

    // The bar is display:none outside the mobile media query, which jsdom never matches,
    // so these query by text: role queries skip it. One product only, so no related cards.
    it('repeats the buy action once the main CTA has scrolled above the viewport', async () => {
      stubCtaScrolledPast()
      renderProduct('frog', { products: [frog] })
      await waitFor(() => expect(screen.getAllByText('Buy now')).toHaveLength(2))
      expect(screen.getAllByText('Buy now')[1]).toHaveAttribute('href', 'https://buy.stripe.com/test_frog')
      expect(screen.getByText('$100.00 CAD', { selector: '.product-bar__price' })).toBeInTheDocument()
    })

    it('repeats Add to cart when a cart is wired', async () => {
      stubCtaScrolledPast()
      renderProduct('frog', { products: [frog], onAddToCart: vi.fn() })
      await waitFor(() => expect(screen.getAllByText('Add to cart')).toHaveLength(2))
    })

    it('is not shown with a cart for a product that has only a Payment Link', async () => {
      stubCtaScrolledPast()
      renderProduct('frog', { products: [{ ...frog, stripePriceId: null }], onAddToCart: vi.fn() })
      await act(async () => {})
      expect(screen.getAllByText('Coming soon')).toHaveLength(1)
    })

    it('stays hidden while the main CTA is on screen', async () => {
      renderProduct('frog', { products: [frog] })
      await act(async () => {})
      expect(screen.getAllByText('Buy now')).toHaveLength(1)
    })

    it('is not shown for a product that cannot be bought', async () => {
      stubCtaScrolledPast()
      renderProduct('mystery-item', { products: [unpriced] })
      await act(async () => {})
      expect(screen.getAllByText('Coming soon')).toHaveLength(1)
    })
  })

  describe('page content', () => {
    it('shows the category in the breadcrumb', () => {
      renderProduct('frog')
      const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem')
      expect(crumbs.map((li) => li.textContent)).toEqual(['Home', '›Prints', '›Frog'])
    })

    it('lists other products, same category first', () => {
      renderProduct('old-frog')
      const related = screen.getByRole('region', { name: 'You might also like' })
      const names = within(related).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
      expect(names).toEqual(['Sobble Cart', 'Frog', 'Mystery Item'])
    })

    it('switches the main photo from the thumbnails', async () => {
      const user = userEvent.setup()
      renderProduct('frog')
      expect(screen.getByRole('button', { name: 'Show photo 1' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Show photo 2' }))
      expect(screen.getByRole('img', { name: 'Frog photo 2' })).toHaveAttribute('src', 'https://files.stripe.com/links/frog-back')
      expect(screen.getByRole('button', { name: 'Show photo 2' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows no thumbnails for a single photo', () => {
      renderProduct('sobble-cart')
      expect(screen.queryByRole('button', { name: /Show photo/ })).not.toBeInTheDocument()
    })

    it('opens the Details accordion by default', () => {
      renderProduct('frog')
      expect(screen.getByRole('heading', { level: 2, name: 'Details' }).closest('details')).toHaveAttribute('open')
    })
  })
})
