import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — end-to-end tests in a real browser.
 *
 * These exist to cover what jsdom structurally cannot: focus management, computed styles,
 * `prefers-reduced-motion`, and whether an element is actually reachable by keyboard. The
 * vitest suite in src/test/ covers logic; this covers behaviour that needs a layout engine.
 *
 * Runs against `vite preview` on the built output rather than the dev server, so the tests
 * exercise the same bundle that ships. `yarn dev` is deliberately not used — it starts
 * `netlify dev`, which needs the Netlify CLI and the checkout function, neither of which the
 * accessibility tests depend on.
 */
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
      // Same specs under prefers-reduced-motion, so the reduced-motion gating added in
      // theme.css and <MotionConfig reducedMotion="user"> is actually exercised rather
      // than assumed. The old vitest matchMedia stub hardcoded matches:false, which made
      // this untestable there.
      name: 'chromium-reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        // MUST be nested under contextOptions. The top-level `reducedMotion: 'reduce'`
        // fixture option is silently ignored in @playwright/test 1.62.1 — the project runs,
        // the name is right, and matchMedia('(prefers-reduced-motion: reduce)') still
        // reports false, so the tests pass against un-reduced styles and prove nothing.
        // Verified: top-level → false, contextOptions → true, page.emulateMedia() → true.
        // Do not "simplify" this back to the top-level form.
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
      // Empty on purpose — matches the CI build. Exercises the `||` fallback in
      // CartDrawer (an empty string here is exactly what the `??` bug mishandled).
      VITE_CHECKOUT_API_URL: '',
    },
  },
})
