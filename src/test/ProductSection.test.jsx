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
    paymentLink: 'https://buy.stripe.com/test_abc',
  },
  {
    productId: 'prod_test2',
    name: 'Galaxy Print',
    description: 'Limited edition galaxy print',
    price: 2499,
    currency: 'USD',
    imageUrl: '/product_placeholder.svg',
    paymentLink: null,
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

  it('shows Buy Now for products with a payment link', () => {
    render(<ProductSection products={mockProducts} />)
    const buyButtons = screen.getAllByRole('link', { name: /buy now/i })
    expect(buyButtons).toHaveLength(1)
    expect(buyButtons[0]).toHaveAttribute('href', 'https://buy.stripe.com/test_abc')
  })

  it('shows Coming Soon for products without a payment link', () => {
    render(<ProductSection products={mockProducts} />)
    expect(screen.getByRole('button', { name: /coming soon/i })).toBeDisabled()
  })
})
