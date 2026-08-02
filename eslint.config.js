import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `lambda` is deliberately NOT ignored: it holds the production checkout handler and the
  // shared core. Excluding it meant `yarn lint` passing said nothing about deployed code.
  globalIgnores([
    'dist',
    '.netlify',
    '.aws-sam',
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
    plugins: { react, 'jsx-a11y': jsxA11y },
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
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      // Accessibility rules would have caught the missing aria-hidden on decorative emoji,
      // the redundant cart-thumbnail alt text, and the unannounced loading state.
      ...jsxA11y.flatConfigs.recommended.rules,

      // No varsIgnorePattern: '^[A-Z_]' — it exempted every capitalized identifier, which is
      // every component import and every animation constant, and is precisely why the dead
      // exports in utils/animations.js were never flagged. react/jsx-uses-vars already
      // handles the "unused component import in JSX" case it was meant to cover.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-uses-vars': 'error',
      // This project passes plain objects around; prop-types adds noise without types.
      'react/prop-types': 'off',
    },
  },
])
