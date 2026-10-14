// frontend/vitest.config.ts —— 单元测试配置
// 跑命令：npm run test:unit         (在前端目录)
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    // 全局环境：vue 单测 + node 单测
    environment: 'happy-dom',
    // 用例发现：tests/unit/**/*.spec.ts（含 __tests__ 容错）
    include: ['tests/unit/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
    // 覆盖率（需装 @vitest/coverage-v8 后才能用）
    // coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**/*.{ts,vue}'] },
    setupFiles: ['./tests/unit/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
