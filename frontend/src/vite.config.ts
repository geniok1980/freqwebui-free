import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get API URL from environment or use default
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://backend:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: true,
    allowedHosts: ['dashboard.mechti.at'],
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
    sourcemap: true,
  },
});
