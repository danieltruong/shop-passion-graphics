import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * IntersectionObserver — framer-motion uses it for whileInView.
 *
 * The previous stub never invoked its callback, so every whileInView element stayed in the
 * `hidden` variant (opacity: 0) for the whole test run. Tests queried by role and passed
 * regardless, which meant a regression leaving the entire shop grid invisible would not have
 * been caught. This version reports every observed element as intersecting, so components
 * render in their visible state as they do in a browser.
 */
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

/**
 * matchMedia — framer-motion reads it for the reduced-motion preference.
 *
 * `setReducedMotion()` below lets tests exercise both branches; the old stub hardcoded
 * `matches: false` and omitted addEventListener/removeEventListener entirely, leaving the app
 * one framer-motion minor version away from a hard failure.
 */
let reducedMotion = false

export function setReducedMotion(value) {
  reducedMotion = value
}

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

// jsdom has no layout engine; framer-motion calls this on animated elements.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  reducedMotion = false
  vi.clearAllMocks()
})
