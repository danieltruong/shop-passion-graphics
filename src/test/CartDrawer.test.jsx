import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartDrawer from '../components/CartDrawer'
import { frog, sobble } from './fixtures'

const line = (product, quantity) => ({ product, quantity })

function renderDrawer(props = {}) {
  const onClose = vi.fn()
  const onUpdateQty = vi.fn()
  const onClear = vi.fn()
  const utils = render(
    <CartDrawer
      cart={[line(frog, 1)]}
      isOpen
      onClose={onClose}
      onUpdateQty={onUpdateQty}
      onClear={onClear}
      error={null}
      {...props}
    />,
  )
  return { ...utils, onClose, onUpdateQty, onClear }
}

/** window.location.href assignment — jsdom refuses navigation, so intercept it. */
let hrefSpy
beforeEach(() => {
  hrefSpy = vi.fn()
  delete window.location
  window.location = { href: '', assign: hrefSpy, pathname: '/', search: '' }
  Object.defineProperty(window.location, 'href', {
    set: hrefSpy,
    get: () => '',
    configurable: true,
  })
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rendering', () => {
  it('renders nothing when closed', () => {
    // The drawer used to stay mounted with aria-modal="true", so AT announced an open dialog
    // on every page load and its controls stayed in the tab order off-screen.
    renderDrawer({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close cart/i })).not.toBeInTheDocument()
  })

  it('renders a labelled modal dialog when open', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog', { name: 'Shopping cart' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('shows the empty state with no checkout button', () => {
    renderDrawer({ cart: [] })
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /checkout/i })).not.toBeInTheDocument()
  })
})

describe('money', () => {
  it('shows the line total, not the unit price', () => {
    // A row reading "CA$34.99" beside a quantity of 3 was routinely misread as the line total.
    const { container } = renderDrawer({ cart: [line(sobble, 3)] })
    expect(container.querySelector('.cart-item-price')).toHaveTextContent(/104\.97/)
  })

  it('shows the unit price as a secondary annotation when quantity > 1', () => {
    renderDrawer({ cart: [line(sobble, 3)] })
    expect(screen.getByText(/each/i)).toHaveTextContent(/34\.99/)
  })

  it('omits the per-unit annotation at quantity 1', () => {
    renderDrawer({ cart: [line(sobble, 1)] })
    expect(screen.queryByText(/each/i)).not.toBeInTheDocument()
  })

  it('computes the subtotal across lines', () => {
    const { container } = renderDrawer({ cart: [line(frog, 2), line(sobble, 1)] })
    // 10000*2 + 3499 = 23499 minor units
    expect(container.querySelector('.cart-subtotal')).toHaveTextContent(/234\.99/)
  })

  it('formats in the catalog currency without a stray dollar sign', () => {
    renderDrawer({ cart: [line(frog, 1)] })
    expect(screen.queryByText(/CAD\s*\$/)).not.toBeInTheDocument()
  })
})

describe('quantity controls', () => {
  it('increments through onUpdateQty using the price key', async () => {
    const { onUpdateQty } = renderDrawer({ cart: [line(frog, 2)] })
    await userEvent.click(screen.getByRole('button', { name: /increase quantity of Frog/i }))
    expect(onUpdateQty).toHaveBeenCalledWith('price_frog', 3)
  })

  it('decrements', async () => {
    const { onUpdateQty } = renderDrawer({ cart: [line(frog, 2)] })
    await userEvent.click(screen.getByRole('button', { name: /decrease quantity of Frog/i }))
    expect(onUpdateQty).toHaveBeenCalledWith('price_frog', 1)
  })

  it('removes with quantity 0', async () => {
    const { onUpdateQty } = renderDrawer({ cart: [line(frog, 2)] })
    await userEvent.click(screen.getByRole('button', { name: /remove Frog/i }))
    expect(onUpdateQty).toHaveBeenCalledWith('price_frog', 0)
  })

  it('disables increment at MAX_QTY instead of letting the backend reject it', () => {
    renderDrawer({ cart: [line(frog, 99)] })
    expect(screen.getByRole('button', { name: /increase quantity of Frog/i })).toBeDisabled()
  })
})

describe('accessibility', () => {
  it('moves focus into the dialog on open', async () => {
    renderDrawer()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus())
  })

  it('closes on Escape', async () => {
    const { onClose } = renderDrawer()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab from the last control back to the first', async () => {
    renderDrawer({ cart: [line(frog, 1)] })
    const focusable = screen.getByRole('dialog').querySelectorAll('button')
    const last = focusable[focusable.length - 1]
    last.focus()
    await userEvent.tab()
    expect(focusable[0]).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    renderDrawer({ cart: [line(frog, 1)] })
    const focusable = screen.getByRole('dialog').querySelectorAll('button')
    focusable[0].focus()
    await userEvent.tab({ shift: true })
    expect(focusable[focusable.length - 1]).toHaveFocus()
  })

  it('uses one status region rather than one per cart line', () => {
    // Per-item live regions were created at the moment their item was added, so the first
    // change after adding often went unannounced.
    renderDrawer({ cart: [line(frog, 1), line(sobble, 2)] })
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('marks cart thumbnails decorative so names are not announced twice', () => {
    const { container } = renderDrawer()
    expect(container.querySelector('.cart-item-img')).toHaveAttribute('alt', '')
  })
})

describe('checkout', () => {
  const stripeUrl = 'https://checkout.stripe.com/c/pay/cs_test_123'

  it('posts only priceId and quantity — never prices', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: stripeUrl }),
    })
    renderDrawer({ cart: [line(frog, 2)] })
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toEqual({ cart: [{ priceId: 'price_frog', quantity: 2 }] })
    expect(JSON.stringify(body)).not.toContain('10000')
  })

  it('redirects to the Stripe URL on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: stripeUrl }),
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    await waitFor(() => expect(hrefSpy).toHaveBeenCalledWith(stripeUrl))
  })

  it('refuses to navigate to a non-Stripe URL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: 'https://evil.tld/gotcha' }),
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid redirect/i)
    expect(hrefSpy).not.toHaveBeenCalled()
  })

  it('refuses to navigate when the response has no url', async () => {
    // Previously this navigated to the literal string "undefined" — a blank 404.
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(hrefSpy).not.toHaveBeenCalled()
  })

  it('surfaces a readable message when the API returns HTML instead of JSON', async () => {
    // The `??`-vs-`||` env bug produced exactly this: a POST to the page returning index.html.
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<!doctype html><html></html>',
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/unexpected response/i)
    expect(alert).not.toHaveTextContent(/JSON\.parse|token/i)
  })

  it('shows the server error message on a 4xx', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'Unknown product' }),
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown product')
  })

  it('explains an empty 404 as a dev-server misconfiguration', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/npm run dev/i)
  })

  it('recovers from a network failure and re-enables the button', async () => {
    global.fetch.mockRejectedValue(new Error('Network down'))
    renderDrawer()
    const button = screen.getByRole('button', { name: /checkout/i })
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    expect(button).toBeEnabled()
  })

  it('keeps the button disabled while navigating away on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: stripeUrl }),
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    await waitFor(() => expect(hrefSpy).toHaveBeenCalled())
    // The document is being torn down; re-enabling would let a second session be created.
    expect(screen.getByRole('button', { name: /creating checkout/i })).toBeDisabled()
  })
})

describe('errors from App', () => {
  it('displays a cart-level error such as a currency mismatch', () => {
    renderDrawer({ error: 'Your cart is in CAD.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Your cart is in CAD.')
  })
})
