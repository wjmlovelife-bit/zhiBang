// tests/unit/setup.ts —— vitest 全局 setup
// - 把 jsdom 中的 localStorage 重置
// - 用 happy-dom 自动注入 window/document

import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
