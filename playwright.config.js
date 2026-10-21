import { defineConfig, devices } from '@playwright/test'

// Real-browser checks jsdom cannot do: focus, computed styles, reduced motion, keyboard reach.
// Runs against `vite preview`, not `yarn dev`, so the tests exercise the bundle that ships.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Tests tagged @mobile or @desktop cover layout that exists at one width only.
  projects: [
    {
      name: 'desktop',
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      grepInvert: /@desktop/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],

  webServer: {
    command: 'yarn build && yarn preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Empty on purpose, matching the CI build: exercises CartDrawer's `||` fallback for "".
      VITE_CHECKOUT_API_URL: '',
    },
  },
})
