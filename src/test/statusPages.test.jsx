import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import NotFoundPage from '../pages/NotFoundPage'
import PrivacyPage from '../pages/PrivacyPage'
import SuccessPage from '../pages/SuccessPage'
import { renderWithRouter } from './renderWithRouter'

describe('SuccessPage', () => {
  it('thanks the customer and sets the title', () => {
    renderWithRouter(<SuccessPage />, { route: '/success' })
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you!' })).toBeInTheDocument()
    expect(document.title).toBe('Thank you | shop.passion.graphics')
  })

  it('shows the checkout reference from session_id', () => {
    renderWithRouter(<SuccessPage />, { route: '/success?session_id=cs_test_123' })
    expect(screen.getByText(/Checkout reference:/)).toHaveTextContent('Checkout reference: cs_test_123')
  })

  it('shows no reference without session_id', () => {
    renderWithRouter(<SuccessPage />, { route: '/success' })
    expect(screen.queryByText(/Checkout reference/)).not.toBeInTheDocument()
  })

  it('links back to the shop', () => {
    renderWithRouter(<SuccessPage />, { route: '/success' })
    expect(screen.getByRole('link', { name: 'Keep shopping' })).toHaveAttribute('href', '/')
  })
})

describe('PrivacyPage', () => {
  it('has its h1 and page title', () => {
    renderWithRouter(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
    expect(document.title).toBe('Privacy policy | shop.passion.graphics')
  })
})

describe('NotFoundPage', () => {
  it('says the page was not found and links back to the shop', () => {
    renderWithRouter(<NotFoundPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(document.title).toBe('Page not found | shop.passion.graphics')
    expect(screen.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute('href', '/')
  })
})
