import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/mcp': 'http://127.0.0.1:3000',
    },
    fs: {
      allow: [new URL('../..', import.meta.url).pathname],
    },
  },
  build: {
    outDir: '../../dist/studio',
    emptyOutDir: true,
  },
})
