import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, screen } from '@testing-library/react'
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
    expect(onAddToCart).toHaveBeenCalledWith(frog, expect.anything())
  })

  describe('"Added" confirmation', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })

    async function clickAdd(accepted) {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      // Testing Library only drains its own setTimeout(0) under fake timers when it sees `jest`.
      vi.stubGlobal('jest', { advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms) })
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
      renderWithRouter(<BuyAction product={frog} onAddToCart={() => accepted} />)
      await user.click(screen.getByRole('button', { name: 'Add to cart' }))
    }

    it('shows "Added" after a successful add, keeping the button name', async () => {
      await clickAdd(true)
      expect(screen.getByText('Added')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add to cart' })).toBeInTheDocument()
    })

    it('hides "Added" again after 1.5 seconds', async () => {
      await clickAdd(true)
      act(() => vi.advanceTimersByTime(1499))
      expect(screen.getByText('Added')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByText('Added')).not.toBeInTheDocument()
    })

    it('shows nothing when the cart refuses the add', async () => {
      await clickAdd(false)
      expect(screen.queryByText('Added')).not.toBeInTheDocument()
    })
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
