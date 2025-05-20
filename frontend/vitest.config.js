import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js', // If you have a setupTests.js, otherwise remove or adapt
    css: true, // If you import CSS in your components
  },
}); 