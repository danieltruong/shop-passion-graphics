import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CartDrawer from '../components/CartDrawer'
import { euroThing, frog } from './fixtures'

// $150.00 CAD; site.js ships null until the owners pick a number.
vi.mock('../content/site', async (importOriginal) => {
  const site = await importOriginal()
  return { ...site, policies: { ...site.policies, freeShippingThresholdCents: 15000 } }
})

function renderDrawer(cart) {
  render(<CartDrawer cart={cart} isOpen onClose={vi.fn()} onUpdateQty={vi.fn()} onClear={vi.fn()} error={null} />)
}

describe('free shipping progress', () => {
  it('shows how far a CAD cart is from the threshold', () => {
    renderDrawer([{ product: frog, quantity: 1 }])
    const bar = screen.getByRole('progressbar', { name: 'Progress to free shipping' })
    expect(bar).toHaveAttribute('aria-valuenow', '67')
    expect(bar).toHaveAttribute('aria-valuetext', '$50.00 CAD away from free shipping in Canada')
    expect(screen.getByText(/away from free shipping in Canada/)).toHaveTextContent('$50.00 CAD away from free shipping in Canada')
  })

  it('caps at 100 and says shipping is free once the threshold is passed', () => {
    renderDrawer([{ product: frog, quantity: 2 }])
    const bar = screen.getByRole('progressbar', { name: 'Progress to free shipping' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute('aria-valuetext', 'You get free shipping in Canada')
  })

  it('falls back to the plain line for a non-CAD cart', () => {
    renderDrawer([{ product: euroThing, quantity: 1 }])
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/^Free shipping in Canada over/)).toBeInTheDocument()
  })
})
