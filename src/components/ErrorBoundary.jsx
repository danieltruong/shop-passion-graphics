import { Component } from 'react'

/**
 * ErrorBoundary — last line of defence against a white screen.
 *
 * A render-time throw anywhere in the tree (a malformed products.json entry, a bad Framer
 * variant) previously unmounted the entire app with no message. Error boundaries must be class
 * components; there is no hook equivalent.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[shop] Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app-error" role="alert">
        <h1 className="rainbow-text">Something broke</h1>
        <p>Sorry — the shop hit an unexpected error.</p>
        <button className="btn-buy" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    )
  }
}
