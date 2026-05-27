import '@testing-library/jest-dom'

// framer-motion uses IntersectionObserver for whileInView — mock it in jsdom
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// framer-motion reads matchMedia for reduced-motion preference
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({ matches: false, addListener() {}, removeListener() {} }),
})
