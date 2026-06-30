import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5166',
        changeOrigin: true,
        secure: false  // Allow self-signed certs in dev
      },
      '/uploads': {
        target: 'http://localhost:5166',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
