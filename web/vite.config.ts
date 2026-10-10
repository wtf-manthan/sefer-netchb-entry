import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@sefer/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:' + (process.env.PORT || loadEnv(mode, path.resolve(__dirname, '..'), 'PORT').PORT || '3001'),
        changeOrigin: true,
      },
    },
  },
}));
