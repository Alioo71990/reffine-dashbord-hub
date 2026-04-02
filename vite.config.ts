import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages deploys to /repo-name/ — set VITE_BASE=/repo-name/ in env
// Netlify / custom domain: leave VITE_BASE unset (defaults to /)
const base = process.env.VITE_BASE || '/'

export default defineConfig({
base: '/reflow-mena-react/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx-vendor'
          if (id.includes('node_modules/jszip')) return 'jszip-vendor'
          if (id.includes('node_modules/@supabase')) return 'supabase-vendor'
          if (id.includes('node_modules/react-dom')) return 'react-dom-vendor'
          if (id.includes('node_modules/react-router')) return 'router-vendor'
        }
      }
    }
  }
})
