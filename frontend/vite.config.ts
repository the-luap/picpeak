import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'react-toastify'],
        },
      },
    },
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
      '/photos': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
})
