import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `lambda` is deliberately NOT ignored: it holds the production checkout handler and the
  // shared core. Excluding it meant `yarn lint` passing said nothing about deployed code.
  globalIgnores([
    'dist',
    '**/.netlify',
    '**/.aws-sam',
    // The vendored yarn release — a 3.7 MB generated bundle, not source.
    '.yarn',
    'lambda/create-checkout/node_modules',
    'coverage',
  ]),

  // Node.js scripts (generate-products, sync-catalog)
  {
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Serverless handlers — Netlify (dev) and Lambda (production)
  {
    files: ['netlify/functions/**/*.js', 'lambda/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Playwright config and end-to-end specs run in Node, not the browser.
  {
    files: ['playwright.config.js', 'e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Vitest test files
  {
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },

  // All JS/JSX source files
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { 'jsx-a11y': jsxA11y },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Accessibility rules would have caught the missing aria-hidden on decorative emoji,
      // the redundant cart-thumbnail alt text, and the unannounced loading state.
      ...jsxA11y.flatConfigs.recommended.rules,

      // No varsIgnorePattern: '^[A-Z_]' would exempt every component import and animation
      // constant. ESLint 10 counts JSX usage as a reference, so none is needed.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
