import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // e2e/*.spec.js matches vitest's default include glob but is a Playwright suite —
    // it imports @playwright/test and cannot run under jsdom. Run it via `yarn test:e2e`.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // Components are styled entirely by CSS classes; processing them keeps class-dependent
    // behaviour (and any future CSS-module usage) honest.
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}', 'lambda/create-checkout/checkout-core.mjs'],
      exclude: ['src/test/**', 'src/main.jsx'],
      thresholds: {
        // Floors, not targets — raise them as coverage grows. The money and checkout paths
        // are covered directly by cart / CartDrawer / checkoutCore.
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  server: {
    proxy: {
      // Forward function calls to netlify dev (port 8888) so browsing on port
      // 5173 (Vite sub-process URL) also reaches the local function runtime.
      '/.netlify/functions': 'http://localhost:8888',
    },
  },
})
