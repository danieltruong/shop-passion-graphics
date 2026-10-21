import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import SiteFooter from '../components/SiteFooter'
import { renderWithRouter } from './renderWithRouter'

describe('SiteFooter', () => {
  it('keeps the mailing list form disabled until a provider exists', () => {
    renderWithRouter(<SiteFooter />)
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeDisabled()
  })

  it('groups the shop links under a heading in the footer nav', () => {
    renderWithRouter(<SiteFooter />)
    const nav = screen.getByRole('navigation', { name: 'Footer' })
    expect(within(nav).getByRole('heading', { level: 2, name: 'Shop links' })).toBeInTheDocument()
  })

  it('links New arrivals to the badge filter on the shop grid', () => {
    renderWithRouter(<SiteFooter />)
    expect(screen.getByRole('link', { name: 'New arrivals' })).toHaveAttribute('href', '/?badge=new#shop')
  })

  it('links the privacy policy page', () => {
    renderWithRouter(<SiteFooter />)
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
  })
})
