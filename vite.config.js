import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    // Handle SPA routing for /success and /cancel routes
    historyApiFallback: true,
    proxy: {
      // Forward function calls to netlify dev (port 8888) so browsing on port
      // 5173 (Vite sub-process URL) also reaches the local function runtime.
      '/.netlify/functions': 'http://localhost:8888',
    },
  },
})
