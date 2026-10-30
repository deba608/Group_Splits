import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Supabase + React land in the main chunk; ~510 kB is expected here.
    chunkSizeWarningLimit: 600,
  },
})
