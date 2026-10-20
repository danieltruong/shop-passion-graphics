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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Same specs under prefers-reduced-motion, so the gating in theme.css and
      // <MotionConfig reducedMotion="user"> is exercised, not assumed.
      name: 'chromium-reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        // Must stay under contextOptions: @playwright/test 1.62.1 silently ignores top-level
        // `reducedMotion`, so matchMedia reports false and the tests prove nothing.
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],

  webServer: {
    command: 'yarn build && yarn preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Empty on purpose, matching the CI build: exercises CartDrawer's `||` fallback for "".
      VITE_CHECKOUT_API_URL: '',
    },
  },
})
