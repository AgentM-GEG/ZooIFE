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

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy SAM2 requests to local Python server
      '/api/sam2': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
