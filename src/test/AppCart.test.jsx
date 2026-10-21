import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { frog, sobble, euroThing, products, mockProductsFetch } from './fixtures'
import { CART_STORAGE_KEY } from '../utils/cart'
import { renderWithRouter } from './renderWithRouter'

// Phase 2 cart: Phase 1 ships with CART_ENABLED false.
vi.mock('../features', () => ({ CART_ENABLED: true }))

async function renderWithProducts(list = products, route = '/') {
  fetch.mockResolvedValueOnce(mockProductsFetch(list))
  renderWithRouter(<App />, { route })
  await screen.findByRole('heading', { name: list[0].name, level: 3 })
}

const cartLines = () => within(screen.getByRole('dialog', { name: 'Shopping cart' })).queryAllByRole('listitem')

describe('App with the cart enabled', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds a product and opens the drawer', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    expect(await screen.findByRole('dialog', { name: 'Shopping cart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument()
  })

  it('increments rather than duplicating on a second add', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    const add = screen.getByRole('button', { name: 'Add to cart: Frog' })
    await user.click(add)
    await user.click(add)
    expect(screen.getByRole('button', { name: 'Cart, 2 items' })).toBeInTheDocument()
    expect(cartLines()).toHaveLength(1)
  })

  it('refuses to mix currencies and explains why', async () => {
    const user = userEvent.setup()
    await renderWithProducts([frog, euroThing])
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(screen.getByRole('button', { name: 'Add to cart: Euro Thing' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cart is in CAD/i)
    expect(cartLines()).toHaveLength(1)
  })

  it('removes a line when its quantity reaches zero', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(await screen.findByRole('button', { name: 'Decrease quantity of Frog' }))
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })

  it('clears the cart', async () => {
    const user = userEvent.setup()
    await renderWithProducts()
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    await user.click(await screen.findByRole('button', { name: /clear cart/i }))
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
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
