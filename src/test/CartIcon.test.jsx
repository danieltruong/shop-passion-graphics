import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartIcon from '../components/CartIcon'
import { frog, sobble } from './fixtures'

const line = (product, quantity) => ({ product, quantity })

describe('CartIcon', () => {
  it('hides the badge when the cart is empty', () => {
    render(<CartIcon cart={[]} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: /0 items/i })).toBeInTheDocument()
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('sums quantities rather than counting lines', () => {
    render(<CartIcon cart={[line(frog, 2), line(sobble, 3)]} onClick={() => {}} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('uses the singular label for exactly one item', () => {
    render(<CartIcon cart={[line(frog, 1)]} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Shopping cart, 1 item' })).toBeInTheDocument()
  })

  it('uses the plural label for more than one', () => {
    render(<CartIcon cart={[line(frog, 2)]} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Shopping cart, 2 items' })).toBeInTheDocument()
  })

  it('caps the badge display at 99+', () => {
    render(<CartIcon cart={[line(frog, 60), line(sobble, 60)]} onClick={() => {}} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
    // The accessible name still carries the real number.
    expect(screen.getByRole('button', { name: /120 items/i })).toBeInTheDocument()
  })

  it('shows the exact count at the 99 boundary', () => {
    render(<CartIcon cart={[line(frog, 99)]} onClick={() => {}} />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('hides the emoji and badge from assistive tech', () => {
    const { container } = render(<CartIcon cart={[line(frog, 2)]} onClick={() => {}} />)
    // The button's aria-label carries the meaning; the visuals must not be double-announced.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })

  it('calls onClick with the event so the trigger can be captured for focus restore', async () => {
    // React clears currentTarget once the handler returns, so it must be read synchronously —
    // which is what App.openCart does. Capture it the same way here.
    let trigger
    const onClick = vi.fn((e) => {
      trigger = e.currentTarget
    })
    render(<CartIcon cart={[]} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(trigger).toBeInstanceOf(HTMLButtonElement)
  })
})
