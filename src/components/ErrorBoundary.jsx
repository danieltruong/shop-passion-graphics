import { Component } from 'react'
import Button from './Button'

/**
 * ErrorBoundary — last line of defence against a white screen. Sits inside BrowserRouter.
 * Error boundaries must be class components; there is no hook equivalent.
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
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    )
  }
}
