import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.{js,mjs,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/dist/**',
        '**/build/**',
        '**/*.config.{js,ts,mjs}',
        '**/types.ts'
      ]
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@utils': path.resolve(__dirname, './utils'),
      '@components': path.resolve(__dirname, './components'),
      '@services': path.resolve(__dirname, './services'),
    }
  }
});
