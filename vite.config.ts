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
