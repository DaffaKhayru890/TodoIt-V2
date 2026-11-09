import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  test: {
    pool: 'threads',
    // 56 file test dijalankan paralel dengan jsdom; membatasi worker mencegah
    // kontensi CPU yang membuat test yang seharusnya cepat melewati 5 detik.
    maxWorkers: 6,
    testTimeout: 20_000,
    environment: 'jsdom',
    env: {
      VITE_API_BASE_URL: 'http://localhost:4000'
    },
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts']
    }
  }
});
