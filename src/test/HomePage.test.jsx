import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '../pages/HomePage'
import { frog, sobble, soldOut } from './fixtures'
import LocationProbe from './LocationProbe'
import { renderWithRouter } from './renderWithRouter'

function renderHome({ route = '/', ...props } = {}) {
  return renderWithRouter(
    <>
      <HomePage products={[frog, sobble]} {...props} />
      <LocationProbe />
    </>,
    { route },
  )
}

const location = () => screen.getByTestId('location').textContent
const cardNames = () =>
  screen.getAllByRole('article').map((card) => within(card).getByRole('heading', { level: 3 }).textContent)
const featuredLink = () => screen.queryByRole('link', { name: /^View it/ })

describe('HomePage', () => {
  it('shows the hero heading and sets the site title', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'graphic design is my passion' })).toBeInTheDocument()
    expect(document.title).toBe('shop.passion.graphics')
  })

  describe('featured product', () => {
    it('picks the first new product', () => {
      renderHome({ products: [sobble, frog] })
      expect(featuredLink()).toHaveAccessibleName('View it: Frog')
      expect(featuredLink()).toHaveAttribute('href', '/products/frog')
    })

    it('falls back to the first product that is not sold out', () => {
      renderHome({ products: [soldOut, sobble] })
      expect(featuredLink()).toHaveAccessibleName('View it: Sobble Cart')
    })

    it('shows none when everything is sold out', () => {
      renderHome({ products: [soldOut] })
      expect(featuredLink()).not.toBeInTheDocument()
    })

    it('shows none while loading', () => {
      renderHome({ loading: true })
      expect(featuredLink()).not.toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('shows none after a load error', () => {
      renderHome({ loadError: 'boom' })
      expect(featuredLink()).not.toBeInTheDocument()
    })
  })

  describe('filters in the URL', () => {
    it('filters by ?category=', () => {
      renderHome({ route: '/?category=Stickers' })
      expect(cardNames()).toEqual(['Sobble Cart'])
      expect(screen.getByRole('button', { name: 'Stickers' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('writes a chip click to ?category= and clears it with All', async () => {
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole('button', { name: 'Prints' }))
      expect(location()).toBe('/?category=Prints')
      expect(cardNames()).toEqual(['Frog'])
      await user.click(screen.getByRole('button', { name: 'All' }))
      expect(location()).toBe('/')
    })

    it('sorts by ?sort=', () => {
      renderHome({ route: '/?sort=price-asc' })
      expect(cardNames()).toEqual(['Sobble Cart', 'Frog'])
      expect(screen.getByRole('combobox', { name: 'Sort:' })).toHaveValue('price-asc')
    })

    it('ignores an unknown sort', () => {
      renderHome({ route: '/?sort=bogus' })
      expect(screen.getByRole('combobox', { name: 'Sort:' })).toHaveValue('newest')
      expect(cardNames()).toEqual(['Frog', 'Sobble Cart'])
    })

    it('writes a sort choice to ?sort= and drops it for the default', async () => {
      const user = userEvent.setup()
      renderHome()
      await user.selectOptions(screen.getByRole('combobox', { name: 'Sort:' }), 'price-desc')
      expect(location()).toBe('/?sort=price-desc')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Sort:' }), 'newest')
      expect(location()).toBe('/')
    })

    it('filters by ?badge= and clears it', async () => {
      const user = userEvent.setup()
      renderHome({ route: '/?badge=new&category=Prints' })
      expect(cardNames()).toEqual(['Frog'])
      await user.click(screen.getByRole('button', { name: 'New arrivals, clear filter' }))
      expect(location()).toBe('/?category=Prints')
    })

    it('ignores an unknown badge', () => {
      renderHome({ route: '/?badge=hot' })
      expect(cardNames()).toEqual(['Frog', 'Sobble Cart'])
      expect(screen.queryByRole('button', { name: /clear filter/ })).not.toBeInTheDocument()
    })

    it('searches by ?q= and clears it', async () => {
      const user = userEvent.setup()
      renderHome({ route: '/?q=sobble' })
      expect(screen.getByText(/Results for/)).toHaveTextContent('Results for “sobble”')
      expect(cardNames()).toEqual(['Sobble Cart'])
      await user.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(location()).toBe('/')
      expect(cardNames()).toEqual(['Frog', 'Sobble Cart'])
    })
  })
})
