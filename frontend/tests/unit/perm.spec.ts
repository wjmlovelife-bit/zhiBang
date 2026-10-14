// tests/unit/perm.spec.ts —— v-perm 权限指令单测
// 直接通过 store.hasPerm 模拟 mounted/updated 的最终效果；不依赖挂载真实 Vue 组件。
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/store/user';

function setDispByPerm(perm: string | string[], originDisp = 'inline-block') {
  const store = useUserStore();
  const ok = store.hasPerm(perm as any);
  return ok ? originDisp : 'none';
}

describe('v-perm 行为（按 store.hasPerm 驱动 display）', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('管理员：任何权限码元素保持显示', () => {
    const store = useUserStore();
    store.setUser({ isAdmin: true, permissions: [] });
    expect(setDispByPerm('opportunity:create')).toBe('inline-block');
    expect(setDispByPerm(['a', 'b'])).toBe('inline-block');
  });

  it('非管理员：无权限码元素 display=none', () => {
    const store = useUserStore();
    store.setUser({ isAdmin: false, permissions: ['customer:view'] });
    expect(setDispByPerm('opportunity:create')).toBe('none');
  });

  it('非管理员：有权限码元素保持显示', () => {
    const store = useUserStore();
    store.setUser({ isAdmin: false, permissions: ['opportunity:create'] });
    expect(setDispByPerm('opportunity:create')).toBe('inline-block');
  });

  it('非管理员：数组入参，任一匹配即显示', () => {
    const store = useUserStore();
    store.setUser({ isAdmin: false, permissions: ['role:view'] });
    expect(setDispByPerm(['role:view', 'role:delete'])).toBe('inline-block');
    expect(setDispByPerm(['role:delete', 'role:create'])).toBe('none');
  });
});
