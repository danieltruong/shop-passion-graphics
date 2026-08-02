import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './theme.css'
import './index.css'
import './App.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root'), {
  // Without this a render-time throw anywhere in the tree blanks the page silently.
  onUncaughtError: (error) => {
    console.error('[shop] Uncaught render error:', error)
  },
}).render(
  <StrictMode>
    {/* reducedMotion="user" makes every Framer animation in the app honour the OS
        preference at once — springs, whileHover, and whileInView included. */}
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
)
