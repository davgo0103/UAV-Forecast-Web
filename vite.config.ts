import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/caa-gis': {
        target: 'https://dronegis.caa.gov.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/caa-gis/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/caa-gis': {
        target: 'https://dronegis.caa.gov.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/caa-gis/, ''),
      },
    },
  },
})
