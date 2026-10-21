import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { frog, sobble, euroThing, products, mockProductsFetch } from './fixtures'
import { CART_STORAGE_KEY } from '../utils/cart'
import { renderWithRouter } from './renderWithRouter'

async function renderWithProducts(list = products, route = '/') {
  fetch.mockResolvedValueOnce(mockProductsFetch(list))
  renderWithRouter(<App />, { route })
  await screen.findByRole('heading', { name: list[0].name, level: 3 })
}

const cartLines = () => within(screen.getByRole('dialog', { name: /your cart/i })).queryAllByRole('listitem')
const headerCount = (n) => screen.getByText(String(n), { selector: '.spg-header__cart-count' })
// framer-motion writes the pulse as an inline transform on its first frame after the effect runs.
const twoFrames = () => act(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

function recordTransforms(el) {
  const seen = []
  new MutationObserver(() => seen.push(el.style.transform)).observe(el, { attributeFilter: ['style'] })
  return seen
}

describe('App with the cart enabled', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('adds a product without opening the drawer', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    const add = screen.getByRole('button', { name: 'Add to cart: Frog' })
    await user.click(add)
    expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(add).getByText('Added')).toBeInTheDocument()
  })

  it('announces each successful add with the new unit count', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    const add = screen.getByRole('button', { name: 'Add to cart: Frog' })
    await user.click(add)
    expect(screen.getByRole('status')).toHaveTextContent('Added Frog to cart. Cart has 1 item.')
    await user.click(add)
    expect(screen.getByRole('status')).toHaveTextContent('Added Frog to cart. Cart has 2 items.')
  })

  it('clears the announcement on the next cart action', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(screen.getByRole('button', { name: 'Cart, 1 item' }))
    await screen.findByRole('dialog')
    expect(screen.queryByText(/^Added Frog/)).not.toBeInTheDocument()
  })

  it('increments rather than duplicating on a second add', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    const add = screen.getByRole('button', { name: 'Add to cart: Frog' })
    await user.click(add)
    await user.click(add)
    await user.click(screen.getByRole('button', { name: 'Cart, 2 items' }))
    expect(cartLines()).toHaveLength(1)
  })

  it('refuses to mix currencies, opens the drawer to explain, and announces no add', async () => {
    const user = userEvent.setup()
    await renderWithProducts([frog, euroThing])
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    const addEuro = screen.getByRole('button', { name: 'Add to cart: Euro Thing' })
    await user.click(addEuro)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cart is in CAD/i)
    expect(cartLines()).toHaveLength(1)
    expect(screen.queryByText(/^Added /)).not.toBeInTheDocument()
    expect(within(addEuro).queryByText('Added')).not.toBeInTheDocument()
  })

  it('opens the drawer with the limit when a line is already at the maximum quantity', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ key: frog.stripePriceId, quantity: 99 }]))
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Maximum 99 per item.')
    expect(screen.getByRole('button', { name: 'Cart, 99 items' })).toBeInTheDocument()
  })

  it('removes a line when its quantity reaches zero', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(screen.getByRole('button', { name: 'Cart, 1 item' }))
    await user.click(await screen.findByRole('button', { name: 'Decrease quantity of Frog' }))
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })

  it('clears the cart', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(screen.getByRole('button', { name: 'Cart, 1 item' }))
    await user.click(await screen.findByRole('button', { name: /clear cart/i }))
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })

  it('bumps the header count on a successful add', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    const seen = recordTransforms(headerCount(0))
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await waitFor(() => expect(seen).toContain('scale(1.25)'))
  })

  it('does not bump the header count for a restored cart', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ key: sobble.stripePriceId, quantity: 2 }]))
    await renderWithProducts()
    await twoFrames()
    expect(headerCount(2).style.transform).toBe('')
  })

  it('restores a stored cart once the catalog loads', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ key: sobble.stripePriceId, quantity: 2 }]))
    await renderWithProducts()
    expect(screen.getByRole('button', { name: 'Cart, 2 items' })).toBeInTheDocument()
  })

  it('starts empty after returning from a completed checkout', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ key: sobble.stripePriceId, quantity: 2 }]))
    fetch.mockResolvedValueOnce(mockProductsFetch())
    renderWithRouter(<App />, { route: '/success?session_id=cs_test_1' })
    expect(await screen.findByRole('button', { name: 'Cart, 0 items' })).toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual([]))
  })

  it('keeps the stored cart when the catalog fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const stored = JSON.stringify([{ key: sobble.stripePriceId, quantity: 2 }])
    localStorage.setItem(CART_STORAGE_KEY, stored)
    fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    renderWithRouter(<App />)
    await screen.findByRole('alert')
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(stored)
  })

  it('persists an added item', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual([{ key: 'price_frog', quantity: 1 }])
    })
  })

  it('returns focus to the cart button when the drawer closes', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Cart, 0 items' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cart, 0 items' })).toHaveFocus())
  })

  it('keeps no dialog in the accessibility tree while the cart is closed', async () => {
    await renderWithProducts()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
