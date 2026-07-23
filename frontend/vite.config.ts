import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { i18nTransform } from './vite-plugin-i18n';

// Get API URL from environment or use default
const API_URL = process.env.VITE_API_URL || 'http://backend:8000';

export default defineConfig({
  plugins: [i18nTransform(), react()],
  server: {
    port: 5000,
    host: true,
    allowedHosts: ['freqdash.com', 'dashboard.mechti.at'],
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: API_URL.replace('http', 'ws'),
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
