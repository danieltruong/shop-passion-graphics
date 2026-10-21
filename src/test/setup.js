import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// framer-motion whileInView needs the callback to fire, or elements stay at opacity 0.
// Report every observed element as intersecting, as a browser would on screen.
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback
    this.elements = new Set()
  }

  observe(element) {
    this.elements.add(element)
    // Deliver asynchronously, as the real API does.
    queueMicrotask(() => {
      if (!this.elements.has(element)) return
      this.callback(
        [{ target: element, isIntersecting: true, intersectionRatio: 1 }],
        this,
      )
    })
  }

  unobserve(element) {
    this.elements.delete(element)
  }

  disconnect() {
    this.elements.clear()
  }

  takeRecords() {
    return []
  }
}

// framer-motion reads matchMedia for reduced motion; setReducedMotion() toggles it per test.
// The listener methods are required: framer-motion subscribes to changes.
let reducedMotion = false

export function setReducedMotion(value) {
  reducedMotion = value
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query) => ({
      media: query,
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // jsdom has no layout engine: App scrolls on navigation, framer-motion on animated elements.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
  window.scrollTo = vi.fn()
}

afterEach(() => {
  cleanup()
  globalThis.localStorage?.clear()
  reducedMotion = false
  vi.clearAllMocks()
})
