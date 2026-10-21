import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductSection from '../components/ProductSection'
import { frog, sobble, soldOut, unpriced } from './fixtures'
import { renderWithRouter } from './renderWithRouter'

const mockProducts = [frog, unpriced]

const cardNames = () =>
  screen.getAllByRole('article').map((card) => within(card).getByRole('heading', { level: 3 }).textContent)

describe('ProductSection', () => {
  it('renders "coming soon" for an empty or missing catalog', () => {
    const { rerender } = renderWithRouter(<ProductSection products={[]} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()

    rerender(<ProductSection products={undefined} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('shows loading text while the catalog loads', () => {
    renderWithRouter(<ProductSection products={[]} loading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('renders a load error with a retry instead of "coming soon" when the fetch failed', () => {
    renderWithRouter(<ProductSection products={[]} loadError="boom" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load the shop/i)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('renders the shop heading and one card per product', () => {
    renderWithRouter(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Shop', level: 2 })).toBeInTheDocument()
    expect(cardNames()).toEqual(['Frog', 'Mystery Item'])
  })

  it('links each card name to its product page', () => {
    renderWithRouter(<ProductSection products={[frog]} />)
    expect(screen.getByRole('link', { name: 'Frog' })).toHaveAttribute('href', '/products/frog')
  })

  it('shows Add to cart only for products with a Stripe price', () => {
    renderWithRouter(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getAllByRole('button', { name: /add to cart/i })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Add to cart: Frog' })).toBeInTheDocument()
  })

  it('shows a disabled Coming soon for products without a Stripe price', () => {
    renderWithRouter(<ProductSection products={mockProducts} onAddToCart={() => {}} />)
    expect(screen.getByRole('button', { name: 'Coming soon: Mystery Item' })).toBeDisabled()
  })

  it('calls onAddToCart with the product', async () => {
    const user = userEvent.setup()
    const handleAddToCart = vi.fn()
    renderWithRouter(<ProductSection products={mockProducts} onAddToCart={handleAddToCart} />)
    await user.click(screen.getByRole('button', { name: 'Add to cart: Frog' }))
    expect(handleAddToCart).toHaveBeenCalledTimes(1)
    expect(handleAddToCart).toHaveBeenCalledWith(frog)
  })

  it('shows a Buy now link to the Payment Link when there is no cart', () => {
    renderWithRouter(<ProductSection products={[frog]} />)
    expect(screen.getByRole('link', { name: 'Buy now: Frog' })).toHaveAttribute('href', frog.paymentLink)
  })

  it('formats prices in the catalog currency, not a hardcoded dollar sign', () => {
    renderWithRouter(<ProductSection products={[frog]} onAddToCart={() => {}} />)
    expect(screen.getByText('$100.00 CAD')).toBeInTheDocument()
  })

  it('marks new and sold-out products', () => {
    renderWithRouter(<ProductSection products={[frog, soldOut]} />)
    const [newCard, soldCard] = screen.getAllByRole('article')
    expect(within(newCard).getByText('NEW!')).toBeInTheDocument()
    expect(within(soldCard).getByText('SOLD OUT')).toBeInTheDocument()
    expect(within(newCard).queryByText('SOLD OUT')).not.toBeInTheDocument()
  })

  it('falls back to the placeholder image when a product has none', () => {
    renderWithRouter(<ProductSection products={[{ ...frog, imageUrl: '' }]} onAddToCart={() => {}} />)
    expect(screen.getByRole('img', { name: 'Frog' })).toHaveAttribute('src', '/product_placeholder.svg')
  })

  it('filters by category and reports the count', () => {
    renderWithRouter(<ProductSection products={[frog, sobble]} category="Stickers" />)
    expect(cardNames()).toEqual(['Sobble Cart'])
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('reports a filter with no matches', () => {
    renderWithRouter(<ProductSection products={[frog]} query="zzz" />)
    expect(screen.getByText(/no products match/i)).toBeInTheDocument()
    expect(screen.getByText('0 items')).toBeInTheDocument()
  })

  it('sorts by price', () => {
    renderWithRouter(<ProductSection products={[frog, sobble]} sort="price-asc" />)
    expect(cardNames()).toEqual(['Sobble Cart', 'Frog'])
  })

  it('passes chip clicks to onCategoryChange', async () => {
    const user = userEvent.setup()
    const onCategoryChange = vi.fn()
    renderWithRouter(<ProductSection products={[frog, sobble]} onCategoryChange={onCategoryChange} />)
    await user.click(screen.getByRole('button', { name: 'Prints' }))
    expect(onCategoryChange).toHaveBeenCalledWith('Prints')
  })

  describe('search query', () => {
    it('shows what was searched for and only matching products', () => {
      renderWithRouter(<ProductSection products={[frog, sobble]} query="frog" />)
      expect(screen.getByText(/Results for/)).toHaveTextContent('Results for “frog”')
      expect(cardNames()).toEqual(['Frog'])
    })

    it('calls onClearQuery from Clear search', async () => {
      const user = userEvent.setup()
      const onClearQuery = vi.fn()
      renderWithRouter(<ProductSection products={[frog]} query="frog" onClearQuery={onClearQuery} />)
      await user.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(onClearQuery).toHaveBeenCalledTimes(1)
    })

    it('shows no search controls without a query', () => {
      renderWithRouter(<ProductSection products={[frog]} />)
      expect(screen.queryByText(/Results for/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    })
  })

  describe('badge filter', () => {
    it('shows only products with the badge', () => {
      renderWithRouter(<ProductSection products={[frog, sobble]} badge="new" />)
      expect(cardNames()).toEqual(['Frog'])
    })

    it('calls onClearBadge from the labelled clear button', async () => {
      const user = userEvent.setup()
      const onClearBadge = vi.fn()
      renderWithRouter(<ProductSection products={[frog]} badge="new" onClearBadge={onClearBadge} />)
      await user.click(screen.getByRole('button', { name: 'New arrivals, clear filter' }))
      expect(onClearBadge).toHaveBeenCalledTimes(1)
    })

    it('labels the sold-out filter', () => {
      renderWithRouter(<ProductSection products={[soldOut]} badge="sold_out" />)
      expect(screen.getByRole('button', { name: 'Sold out, clear filter' })).toBeInTheDocument()
    })
  })
})
