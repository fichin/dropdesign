import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API (backend/, port 3001) is reached through Vite, so the
    // browser sees one origin and no CORS setup is needed. Production uses VITE_API_URL.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
