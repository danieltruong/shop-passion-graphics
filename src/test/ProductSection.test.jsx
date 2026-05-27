import { render, screen } from '@testing-library/react'
import ProductSection from '../components/ProductSection'

const mockProducts = [
  {
    productId: 'prod_test1',
    name: 'Frog Sticker Pack',
    description: 'Premium holographic frog stickers',
    price: 999,
    currency: 'USD',
    imageUrl: '/product_placeholder.svg',
    stripePriceId: 'price_test_abc',
  },
  {
    productId: 'prod_test2',
    name: 'Galaxy Print',
    description: 'Limited edition galaxy print',
    price: 2499,
    currency: 'USD',
    imageUrl: '/product_placeholder.svg',
    stripePriceId: null,
  },
]

describe('ProductSection', () => {
  it('renders "coming soon" when products array is empty', () => {
    render(<ProductSection products={[]} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('renders "coming soon" when products is undefined', () => {
    render(<ProductSection products={undefined} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('renders the shop heading when products are provided', () => {
    render(<ProductSection products={mockProducts} />)
    expect(screen.getByRole('heading', { name: /shop/i })).toBeInTheDocument()
  })

  it('renders all product names', () => {
    render(<ProductSection products={mockProducts} />)
    expect(screen.getByText('Frog Sticker Pack')).toBeInTheDocument()
    expect(screen.getByText('Galaxy Print')).toBeInTheDocument()
  })

  it('shows Add to Cart for products with a Stripe price', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    const addButtons = screen.getAllByRole('button', { name: /add to cart/i })
    expect(addButtons).toHaveLength(1)
  })

  it('shows Coming Soon for products without a Stripe price', () => {
    render(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('button', { name: /coming soon/i })).toBeDisabled()
  })
})
