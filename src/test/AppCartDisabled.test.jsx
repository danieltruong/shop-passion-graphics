import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import App from '../App'
import { badLink, mockProductsFetch } from './fixtures'
import { renderWithRouter } from './renderWithRouter'

// CART_ENABLED is the kill switch back to Payment Links; this file checks that path still works.
vi.mock('../features', () => ({ CART_ENABLED: false }))

async function renderLoaded(list) {
  fetch.mockResolvedValueOnce(mockProductsFetch(list))
  renderWithRouter(<App />)
  await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
}

describe('App with the cart disabled', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows no cart button, add-to-cart buttons or drawer', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: /^Cart/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sells through Payment Links instead', async () => {
    await renderLoaded()
    expect(screen.getByRole('link', { name: 'Buy now: Frog' })).toHaveAttribute('href', 'https://buy.stripe.com/test_frog')
  })

  it('drops a non-Stripe Payment Link from the catalog', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderLoaded([badLink])
    expect(screen.queryByRole('link', { name: /Buy now/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coming soon: Bad Link' })).toBeDisabled()
  })
})
