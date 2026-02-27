import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/terminal': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/acp': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
