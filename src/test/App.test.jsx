import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { frog, sobble, euroThing, products, mockProductsFetch } from './fixtures'
import { CART_STORAGE_KEY } from '../utils/cart'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('catalog loading', () => {
    it('shows a loading state until the fetch settles', async () => {
      // Build the pending promise eagerly — creating it inside json() would leave `resolveJson`
      // unassigned until React actually calls it.
      let resolveJson
      const pending = new Promise((r) => {
        resolveJson = r
      })
      fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => pending })
      render(<App />)

      // The status role is what makes this announced — the old markup had no role at all.
      expect(screen.getByRole('status')).toHaveTextContent(/loading/i)

      resolveJson({ products })
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })

    it('renders products after a successful fetch', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      expect(await screen.findByRole('heading', { name: 'Frog', level: 3 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Sobble Cart', level: 3 })).toBeInTheDocument()
    })

    it('distinguishes a failed fetch from an empty catalog', async () => {
      // Both used to render "coming soon", so a CDN outage looked like a shop with no stock.
      fetch.mockResolvedValueOnce({ ok: false, status: 503 })
      render(<App />)
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/couldn't load the shop/i)
      expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
      expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('shows "coming soon" for a genuinely empty catalog', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch([]))
      render(<App />)
      expect(await screen.findByText(/coming soon/i)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('survives a network rejection without crashing', async () => {
      fetch.mockRejectedValueOnce(new Error('offline'))
      render(<App />)
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })
  })

  describe('cart', () => {
    async function renderWithProducts(list = products) {
      fetch.mockResolvedValueOnce(mockProductsFetch(list))
      render(<App />)
      await screen.findByRole('heading', { name: list[0].name, level: 3 })
    }

    it('adds a product and opens the drawer', async () => {
      await renderWithProducts()
      await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0])
      expect(await screen.findByRole('dialog', { name: 'Shopping cart' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /shopping cart, 1 item$/i })).toBeInTheDocument()
    })

    it('increments rather than duplicating on a second add', async () => {
      await renderWithProducts()
      const add = screen.getAllByRole('button', { name: /add to cart/i })[0]
      await userEvent.click(add)
      await userEvent.click(add)
      expect(screen.getByRole('button', { name: /shopping cart, 2 items/i })).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('refuses to mix currencies and explains why', async () => {
      await renderWithProducts([frog, euroThing])
      const adds = screen.getAllByRole('button', { name: /add to cart/i })
      await userEvent.click(adds[0])
      await userEvent.click(adds[1])
      expect(await screen.findByRole('alert')).toHaveTextContent(/cart is in CAD/i)
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('removes a line when its quantity reaches zero', async () => {
      await renderWithProducts()
      await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0])
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /decrease quantity of Frog/i }))
      expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
    })

    it('clears the cart', async () => {
      await renderWithProducts()
      await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0])
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /clear cart/i }))
      expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
    })
  })

  describe('cart persistence', () => {
    it('restores a stored cart once the catalog loads', async () => {
      // Stripe's cancel_url returns to `/`, which previously wiped the cart entirely.
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify([{ key: sobble.stripePriceId, quantity: 2 }]),
      )
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      expect(
        await screen.findByRole('button', { name: /shopping cart, 2 items/i }),
      ).toBeInTheDocument()
    })

    it('persists an added item', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      await screen.findByRole('heading', { name: 'Frog', level: 3 })
      await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0])

      await waitFor(() => {
        expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual([
          { key: 'price_frog', quantity: 1 },
        ])
      })
    })
  })

  describe('accessibility', () => {
    it('renders a skip link as the first focusable element', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      await screen.findByRole('heading', { name: 'Frog', level: 3 })
      await userEvent.tab()
      expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveFocus()
    })

    it('returns focus to the cart button when the drawer closes', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      await screen.findByRole('heading', { name: 'Frog', level: 3 })

      const cartButton = screen.getByRole('button', { name: /shopping cart/i })
      await userEvent.click(cartButton)
      await screen.findByRole('dialog')

      await userEvent.keyboard('{Escape}')
      // Previously focus landed on <body>, so the next Tab restarted at the top of the page.
      await waitFor(() => expect(screen.getByRole('button', { name: /shopping cart/i })).toHaveFocus())
    })

    it('keeps no dialog in the accessibility tree while the cart is closed', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      render(<App />)
      await screen.findByRole('heading', { name: 'Frog', level: 3 })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
