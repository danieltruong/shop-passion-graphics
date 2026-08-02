import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductSection from '../components/ProductSection'
import { frog, unpriced } from './fixtures'

const mockProducts = [frog, unpriced]

describe('ProductSection', () => {
  it('renders "coming soon" for an empty or missing catalog', () => {
    const { rerender } = render(<ProductSection products={[]} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()

    rerender(<ProductSection products={undefined} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('renders a load error instead of "coming soon" when the fetch failed', () => {
    render(<ProductSection products={[]} loadError="boom" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load the shop/i)
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('renders the shop heading when products are provided', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('heading', { name: /shop/i })).toBeInTheDocument()
  })

  it('renders all product names', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Frog', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mystery Item', level: 3 })).toBeInTheDocument()
  })

  it('shows Add to Cart only for products with a Stripe price', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getAllByRole('button', { name: /add to cart/i })).toHaveLength(1)
  })

  it('shows a disabled Coming Soon for products without a Stripe price', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('button', { name: /coming soon/i })).toBeDisabled()
  })

  it('calls onAddToCart with the product', async () => {
    const handleAddToCart = vi.fn()
    render(<ProductSection products={mockProducts} onAddToCart={handleAddToCart} />)
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(handleAddToCart).toHaveBeenCalledTimes(1)
    expect(handleAddToCart).toHaveBeenCalledWith(frog)
  })

  it('formats prices in the catalog currency, not a hardcoded dollar sign', () => {
    render(<ProductSection products={[frog]} onAddToCart={() => {}} />)
    expect(screen.getByText(/100\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/CAD\s*\$/)).not.toBeInTheDocument()
  })

  it('falls back to the placeholder image when a product has none', () => {
    const { container } = render(
      <ProductSection products={[{ ...frog, imageUrl: '' }]} onAddToCart={() => {}} />,
    )
    expect(container.querySelector('.product-image img')).toHaveAttribute(
      'src',
      '/product_placeholder.svg',
    )
  })
})
