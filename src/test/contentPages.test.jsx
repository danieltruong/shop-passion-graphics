import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import AboutPage from '../pages/AboutPage'
import FaqPage from '../pages/FaqPage'
import ShippingPage from '../pages/ShippingPage'
import { renderWithRouter } from './renderWithRouter'

describe('AboutPage', () => {
  it('has its h1 and page title', () => {
    renderWithRouter(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'About the shop' })).toBeInTheDocument()
    expect(document.title).toBe('About the shop | shop.passion.graphics')
  })

  it('lists how things are made in order', () => {
    renderWithRouter(<AboutPage />)
    const how = screen.getByRole('region', { name: "How it's made" })
    const steps = within(how).getAllByRole('listitem').map((li) => within(li).getByRole('strong').textContent)
    expect(steps).toEqual(['Designed', 'Made by hand', 'Packed & shipped'])
  })
})

describe('FaqPage', () => {
  it('has its h1 and page title', () => {
    renderWithRouter(<FaqPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeInTheDocument()
    expect(document.title).toBe('Frequently asked questions | shop.passion.graphics')
  })

  it('links each topic to its section', () => {
    renderWithRouter(<FaqPage />)
    const topics = within(screen.getByRole('navigation', { name: 'FAQ topics' })).getAllByRole('link')
    expect(topics.map((a) => a.getAttribute('href'))).toEqual(['#orders', '#shipping', '#returns', '#products'])
    expect(screen.getByRole('region', { name: 'Products' })).toHaveAttribute('id', 'products')
  })

  it('opens only the first question', () => {
    renderWithRouter(<FaqPage />)
    const open = screen.getAllByRole('group').filter((d) => d.hasAttribute('open'))
    expect(open).toHaveLength(1)
    expect(within(open[0]).getByRole('heading', { level: 3 })).toHaveTextContent('How do I pay?')
  })

  it('keeps the passion joke', () => {
    renderWithRouter(<FaqPage />)
    expect(screen.getByRole('heading', { level: 3, name: 'Is graphic design really your passion?' })).toBeInTheDocument()
  })
})

describe('ShippingPage', () => {
  it('has its h1 and page title', () => {
    renderWithRouter(<ShippingPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Shipping & returns' })).toBeInTheDocument()
    expect(document.title).toBe('Shipping & returns | shop.passion.graphics')
  })

  it('names the rates table by its caption, with four column headers', () => {
    renderWithRouter(<ShippingPage />)
    const table = screen.getByRole('table', { name: 'Shipping rates' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Destination',
      'Method',
      'Delivery time',
      'Cost',
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(4)
  })

  it('labels each cell with its column for the stacked mobile layout', () => {
    renderWithRouter(<ShippingPage />)
    const row = screen.getByRole('row', { name: /Everywhere else/ })
    expect(within(row).getAllByRole('cell').map((td) => td.dataset.label)).toEqual([
      'Destination',
      'Method',
      'Delivery time',
      'Cost',
    ])
  })

  it('reads "Not available" instead of a bare dash', () => {
    renderWithRouter(<ShippingPage />)
    const row = screen.getByRole('row', { name: /Everywhere else/ })
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('Not available')
    expect(within(row).getByText('—')).toHaveAttribute('aria-hidden', 'true')
  })

  it('lets keyboard users reach the scrolling table', () => {
    renderWithRouter(<ShippingPage />)
    expect(screen.getByRole('group', { name: 'Shipping rates table' })).toHaveAttribute('tabindex', '0')
  })
})
