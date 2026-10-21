import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BuyAction from '../components/BuyAction'
import { frog, soldOut, unpriced } from './fixtures'
import { renderWithRouter } from './renderWithRouter'

describe('BuyAction', () => {
  it('offers an email link for a sold-out product, even with a cart and a Payment Link', () => {
    renderWithRouter(<BuyAction product={soldOut} onAddToCart={() => {}} />)
    expect(screen.getByRole('link', { name: "Email me when it's back" })).toHaveAttribute('href', 'mailto:[email]')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('adds to cart when a cart is wired and the product has a price', async () => {
    const user = userEvent.setup()
    const onAddToCart = vi.fn()
    renderWithRouter(<BuyAction product={frog} onAddToCart={onAddToCart} />)
    await user.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(onAddToCart).toHaveBeenCalledWith(frog)
  })

  it('links to the Payment Link when there is no cart', () => {
    renderWithRouter(<BuyAction product={frog} />)
    expect(screen.getByRole('link', { name: 'Buy now' })).toHaveAttribute('href', 'https://buy.stripe.com/test_frog')
  })

  it('shows a disabled Coming soon with neither a cart price nor a Payment Link', () => {
    renderWithRouter(<BuyAction product={unpriced} />)
    expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled()
  })

  it('shows Coming soon with a cart but no Stripe price', () => {
    renderWithRouter(<BuyAction product={{ ...frog, stripePriceId: null }} onAddToCart={() => {}} />)
    expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled()
  })

  it.each([
    ['link', "Email me when it's back: Old Frog", soldOut],
    ['link', 'Buy now: Frog', frog],
    ['button', 'Coming soon: Mystery Item', unpriced],
  ])('names the %s "%s" when nameInLabel is set', (role, name, product) => {
    renderWithRouter(<BuyAction product={product} nameInLabel />)
    expect(screen.getByRole(role, { name })).toBeInTheDocument()
  })

  it('adds the product name to the Add to cart label when asked', () => {
    renderWithRouter(<BuyAction product={frog} onAddToCart={() => {}} nameInLabel />)
    expect(screen.getByRole('button', { name: 'Add to cart: Frog' })).toBeInTheDocument()
  })
})
