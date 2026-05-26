import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

// Mock fetch for products.json
const mockProducts = {
  products: [
    {
      productId: 'prod_abc',
      name: 'Test Product',
      description: 'A test product',
      price: 1500,
      currency: 'USD',
      imageUrl: '/product_placeholder.svg',
      paymentLink: 'https://buy.stripe.com/test',
    },
  ],
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading state initially', () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => new Promise(() => {}), // never resolves = stays loading
    })
    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders products after successful fetch', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProducts),
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument()
    })
  })

  it('renders coming soon when fetch fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    })
  })
})
