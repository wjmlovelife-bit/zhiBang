import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    root: '.',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./setup.ts'],  // R15：mock sendBeacon
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../frontend/src'),
      // 强制 pinia 走 frontendTest 内的 pinia（frontend/src 的源码 import pinia 时避免走 frontend/node_modules）
      'pinia': path.resolve(__dirname, 'node_modules/pinia'),
    },
  },
});
