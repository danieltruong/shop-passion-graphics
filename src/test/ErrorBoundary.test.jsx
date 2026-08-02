import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'
import SuccessBanner from '../components/SuccessBanner'

function Boom() {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error; silence it so the run stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows a recoverable fallback instead of a blank page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/something broke/i)
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })
})

describe('SuccessBanner', () => {
  const setLocation = (pathname, search) => {
    delete window.location
    window.location = { pathname, search, href: '' }
  }

  it('renders nothing on the normal shop page', () => {
    setLocation('/', '')
    const { container } = render(<SuccessBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on /success without a session id', () => {
    setLocation('/success', '')
    const { container } = render(<SuccessBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('confirms the order when returning from Stripe', () => {
    // success_url is ${origin}/success?session_id={CHECKOUT_SESSION_ID}; without this the
    // customer landed on an S3 404 immediately after paying.
    setLocation('/success', '?session_id=cs_test_123')
    render(<SuccessBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/thanks for your order/i)
    expect(screen.getByRole('link', { name: /back to the shop/i })).toHaveAttribute('href', '/')
  })
})
