import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      graphql: path.resolve(__dirname, './src/lib/graphql-stub.ts'),
      'tough-cookie': path.resolve(__dirname, './src/lib/graphql-stub.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
          network: ['axios', 'msw', '@mswjs/socket.io-binding'],
          ui: ['lucide-react', 'decimal.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    },
  },
});
