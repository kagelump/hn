import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 68,
        functions: 80
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/main.ts',
        'src/styles/**',
        'src/modules/about.ts',
        'src/modules/article.ts',
        'src/modules/comments.ts',
        'src/modules/settings.ts',
        'src/modules/performance-page.ts',
        'src/modules/router.ts'
      ]
    }
  }
});
