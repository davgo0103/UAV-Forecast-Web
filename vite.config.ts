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
      '/opentopodata': {
        target: 'https://api.opentopodata.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opentopodata/, ''),
      },
      '/opensky-auth': {
        target: 'https://auth.opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opensky-auth/, ''),
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
      '/opentopodata': {
        target: 'https://api.opentopodata.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opentopodata/, ''),
      },
      '/opensky-auth': {
        target: 'https://auth.opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opensky-auth/, ''),
      },
    },
  },
})
