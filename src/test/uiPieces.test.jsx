import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Accordion from '../components/Accordion'
import PriceSticker from '../components/PriceSticker'
import ProductImage from '../components/ProductImage'
import Starburst from '../components/Starburst'
import Starfield from '../components/Starfield'
import StepList from '../components/StepList'
import Window from '../components/Window'

describe('Accordion', () => {
  it('puts the title in a heading of the requested level inside the summary', () => {
    render(<Accordion title="Details" headingLevel={2}>Body text</Accordion>)
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument()
  })

  it('starts closed and opens when the summary is clicked', async () => {
    const user = userEvent.setup()
    render(<Accordion title="Question">Answer</Accordion>)
    const details = screen.getByRole('group')
    expect(details).not.toHaveAttribute('open')
    await user.click(screen.getByText('Question'))
    expect(details).toHaveAttribute('open')
  })

  it('starts open with defaultOpen', () => {
    render(<Accordion title="Question" defaultOpen>Answer</Accordion>)
    expect(screen.getByRole('group')).toHaveAttribute('open')
  })
})

describe('Window', () => {
  it('labels a section window by its title', () => {
    render(<Window as="section" titleAs="h2" title="Shipping rates">rates</Window>)
    expect(screen.getByRole('region', { name: 'Shipping rates' })).toHaveTextContent('rates')
    expect(screen.getByRole('heading', { level: 2, name: 'Shipping rates' })).toBeInTheDocument()
  })

  it('is not a landmark when rendered as a div', () => {
    render(<Window title="Featured">body</Window>)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('hides the decorative window controls from assistive tech', () => {
    render(<Window title="Featured" controls>body</Window>)
    expect(screen.getByText('×').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('PriceSticker', () => {
  it('shows the formatted price', () => {
    render(<PriceSticker amount={1200} currency="CAD" />)
    expect(screen.getByText('$12.00 CAD')).toBeInTheDocument()
  })

  it('passes the rotation to CSS', () => {
    render(<PriceSticker amount={1200} currency="CAD" rotate={-3} />)
    expect(screen.getByText('$12.00 CAD').style.getPropertyValue('--sticker-rotate')).toBe('-3deg')
  })
})

describe('Starburst', () => {
  it('reads NEW!', () => {
    render(<Starburst />)
    expect(screen.getByText('NEW!')).toBeInTheDocument()
  })
})

describe('StepList', () => {
  const steps = [
    { title: 'Designed', text: 'Sketched first.' },
    { title: 'Made', text: 'By hand.' },
  ]

  it('renders the steps as an ordered list with zero-padded numbers', () => {
    render(<StepList steps={steps} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['01DesignedSketched first.', '02MadeBy hand.'])
    expect(screen.getByRole('list').tagName).toBe('OL')
  })

  it('uses plain numbers when padNumbers is false', () => {
    render(<StepList steps={steps} padNumbers={false} />)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/^1Designed/)
  })
})

describe('ProductImage', () => {
  it('uses the placeholder when there is no src', () => {
    render(<ProductImage src="" alt="Frog" />)
    expect(screen.getByRole('img', { name: 'Frog' })).toHaveAttribute('src', '/product_placeholder.svg')
  })

  it('swaps to the placeholder when the image fails to load', () => {
    render(<ProductImage src="https://files.stripe.com/links/gone" alt="Frog" />)
    const img = screen.getByRole('img', { name: 'Frog' })
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', '/product_placeholder.svg')
  })

  it('does not reassign src when the placeholder itself fails', () => {
    render(<ProductImage src="https://files.stripe.com/links/gone" alt="Frog" />)
    const img = screen.getByRole('img', { name: 'Frog' })
    const assigned = []
    const { get, set } = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    Object.defineProperty(img, 'src', {
      get() { return get.call(this) },
      set(value) { assigned.push(value); set.call(this, value) },
    })
    fireEvent.error(img)
    fireEvent.error(img)
    // A browser would fire error again on each reassignment: an endless retry loop.
    expect(assigned).toEqual(['/product_placeholder.svg'])
  })
})

describe('Starfield', () => {
  it('renders three parallax layers hidden from assistive tech', () => {
    const { container } = render(<Starfield />)
    const field = container.querySelector('.starfield')
    expect(field).toHaveAttribute('aria-hidden', 'true')
    expect(field.querySelectorAll('.starfield__stars')).toHaveLength(3)
  })
})
