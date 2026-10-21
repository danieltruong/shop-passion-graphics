import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate } from 'react-router'
import App from '../App'
import { frog, mockProductsFetch } from './fixtures'
import { renderWithRouter } from './renderWithRouter'

function renderApp(route = '/', extra = null) {
  return renderWithRouter(
    <>
      <App />
      {extra}
    </>,
    { route },
  )
}

function NavProbe() {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate('/about')}>probe push</button>
      <button onClick={() => navigate(-1)}>probe back</button>
    </>
  )
}

async function renderLoaded(route = '/', list, extra) {
  fetch.mockResolvedValueOnce(mockProductsFetch(list))
  const view = renderApp(route, extra)
  await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
  return view
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('catalog loading', () => {
    it('announces loading until the fetch settles', async () => {
      let resolveJson
      const pending = new Promise((r) => {
        resolveJson = r
      })
      fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => pending })
      renderApp()

      expect(screen.getByRole('status')).toHaveTextContent('Loading the shop')
      resolveJson({ products: [frog] })
      await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
    })

    it('renders products after a successful fetch', async () => {
      fetch.mockResolvedValueOnce(mockProductsFetch())
      renderApp()
      expect(await screen.findByRole('heading', { name: 'Frog', level: 3 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Sobble Cart', level: 3 })).toBeInTheDocument()
    })

    it('distinguishes a failed fetch from an empty catalog', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetch.mockResolvedValueOnce({ ok: false, status: 503 })
      renderApp()
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/couldn't load the shop/i)
      expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('shows "coming soon" for a genuinely empty catalog', async () => {
      await renderLoaded('/', [])
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('survives a network rejection without crashing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetch.mockRejectedValueOnce(new Error('offline'))
      renderApp()
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })
  })

  describe('routes', () => {
    it.each([
      ['/', 'graphic design is my passion'],
      ['/products/frog', 'Frog'],
      ['/about', 'About the shop'],
      ['/faq', 'Frequently asked questions'],
      ['/shipping', 'Shipping & returns'],
      ['/success', 'Thank you!'],
      ['/privacy', 'Privacy policy'],
      ['/nope', 'Page not found'],
    ])('%s has the h1 "%s"', async (route, heading) => {
      await renderLoaded(route)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
    })

    it('keeps the skip link first in tab order', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await user.tab()
      expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
    })
  })

  describe('scroll and focus on navigation', () => {
    it('moves to the top and focuses main on a link, but not on back', async () => {
      const user = userEvent.setup()
      await renderLoaded('/', undefined, <NavProbe />)

      await user.click(screen.getByRole('button', { name: 'probe push' }))
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About the shop')
      expect(window.scrollTo).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('main')).toHaveFocus()

      window.scrollTo.mockClear()
      await user.click(screen.getByRole('button', { name: 'probe back' }))
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('graphic design is my passion')
      expect(window.scrollTo).not.toHaveBeenCalled()
      expect(screen.getByRole('main')).not.toHaveFocus()
    })
  })

  describe('pause toggle', () => {
    it('marks the app as paused and unpaused', async () => {
      const user = userEvent.setup()
      const { container } = await renderLoaded()
      const app = container.querySelector('.app')
      // jsdom drops the space before the visually hidden " animations"; browsers keep it.
      const pause = screen.getByRole('button', { name: /^Pause ?animations$/ })

      expect(app).not.toHaveAttribute('data-animations-paused')
      await user.click(pause)
      expect(pause).toHaveAttribute('aria-pressed', 'true')
      expect(app).toHaveAttribute('data-animations-paused', 'true')
      await user.click(pause)
      expect(app).not.toHaveAttribute('data-animations-paused')
    })
  })

  describe('header search', () => {
    it('filters the home page grid from another page', async () => {
      const user = userEvent.setup()
      await renderLoaded('/about')
      await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'sobble{Enter}')
      const shop = await screen.findByRole('region', { name: 'Shop' })
      expect(within(shop).getByText(/Results for/)).toHaveTextContent('Results for “sobble”')
      expect(within(shop).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Sobble Cart'])
    })
  })
})
