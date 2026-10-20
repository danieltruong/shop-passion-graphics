import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { text } from 'node:stream/consumers'
import { handleCheckout } from './lambda/create-checkout/checkout-core.mjs'

const CATALOG_PATH = fileURLToPath(new URL('./public/products.json', import.meta.url))

/** Dev stand-in for lambda/create-checkout/index.mjs: Node req/res instead of an API Gateway event. */
export async function checkoutMiddleware(req, res, env) {
  const { status, headers, body } = await handleCheckout(
    {
      method: req.method,
      origin: req.headers.origin ?? '',
      body: await text(req),
      catalogPath: CATALOG_PATH,
    },
    env,
  )
  res.writeHead(status, body === '' ? headers : { ...headers, 'Content-Type': 'application/json' })
  res.end(body === '' ? '' : JSON.stringify(body))
}

// Vite's cors middleware answers preflights and sets CORS headers first: dev CORS is looser than the Lambda.
const checkoutDevApi = {
  name: 'checkout-dev-api',
  apply: 'serve',
  configureServer(server) {
    // Vite keeps .env.local off process.env, and handleCheckout needs STRIPE_SECRET_KEY and ALLOWED_ORIGIN.
    const env = loadEnv(server.config.mode, server.config.envDir, '')
    server.middlewares.use('/api/create-checkout', (req, res, next) => {
      checkoutMiddleware(req, res, env).catch(next)
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), checkoutDevApi],
  // ALLOWED_ORIGIN names :5173, so a busy port must fail rather than move to :5174 and 403.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // CartDrawer's URL assertion expects the /api/create-checkout fallback even if .env.local sets this.
    env: { VITE_CHECKOUT_API_URL: '' },
    // nmHoistingLimits gives lambda/create-checkout its own stripe, so vi.mock('stripe') would
    // miss checkout-core.mjs's import; pointing both at the root copy makes the mock apply.
    alias: {
      stripe: fileURLToPath(new URL('./node_modules/stripe', import.meta.url)),
    },
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
})
