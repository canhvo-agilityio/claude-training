import { DEFAULT_PORT } from '@e2e-buddy/contracts';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Dev proxy assumes the default server port; a custom `port` in config.json is not picked up here.
    proxy: {
      '/api': `http://127.0.0.1:${DEFAULT_PORT}`,
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
