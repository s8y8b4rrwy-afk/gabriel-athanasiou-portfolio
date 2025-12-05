import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  server: {
    port: 5174,
    open: true,
    allowedHosts: true, // Allow all hosts (for ngrok)
    fs: {
      // Allow serving files from the parent public folder
      allow: ['..', '../..'],
    },
  },
  // Serve portfolio data from parent public folder
  publicDir: resolve(__dirname, '../../public'),
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
