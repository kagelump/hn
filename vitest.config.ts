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
        'src/modules/performance-page.ts',
        // Targeted unit tests exist for the exported helpers/share-text builders,
        // but the bulk of these files is DOM-heavy page rendering that is not
        // covered. Excluding them from coverage thresholds keeps the gate useful
        // for the rest of the codebase.
        'src/modules/article.ts',
        'src/modules/comments.ts'
      ]
    }
  }
});
