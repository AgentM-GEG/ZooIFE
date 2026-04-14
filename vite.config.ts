/**
 * Polyfill for crypto.getRandomValues (required by Vite in older Node.js or
 * some Linux environments where it may be undefined)
 */
import { randomFillSync } from 'node:crypto'
if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  globalThis.crypto = globalThis.crypto || {}
  globalThis.crypto.getRandomValues = function <T extends ArrayBufferView>(buffer: T): T {
    randomFillSync(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))
    return buffer
  }
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Read package.json to get app version
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      // Proxy SAM2 requests to local Python server
      '/api/sam2': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
