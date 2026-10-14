// tests/unit/user-store.spec.ts —— pinia user store 单测
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/store/user';

describe('store/user', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  describe('hasPerm', () => {
    it('管理员直接放行（无 permissions 数组也无碍）', () => {
      const store = useUserStore();
      store.setUser({ isAdmin: true, permissions: [] });
      expect(store.hasPerm('any:code')).toBe(true);
      expect(store.hasPerm(['a:1', 'b:2'])).toBe(true);
    });

    it('非管理员：拥有任一权限码即返回 true', () => {
      const store = useUserStore();
      store.setUser({ isAdmin: false, permissions: ['customer:view', 'customer:create'] });
      expect(store.hasPerm('customer:view')).toBe(true);
      expect(store.hasPerm(['customer:view', 'order:x'])).toBe(true);
    });

    it('非管理员：无任何权限码返回 false', () => {
      const store = useUserStore();
      store.setUser({ isAdmin: false, permissions: [] });
      expect(store.hasPerm('customer:view')).toBe(false);
      expect(store.hasPerm(['customer:view', 'order:x'])).toBe(false);
    });

    it('字符串 / 数组两种入参形态均能正确处理', () => {
      const store = useUserStore();
      store.setUser({ isAdmin: false, permissions: ['x:1'] });
      expect(store.hasPerm('x:1')).toBe(true);          // string 入参
      expect(store.hasPerm(['x:1', 'x:2'])).toBe(true); // array 入参（任一匹配）
      expect(store.hasPerm(['x:2', 'x:3'])).toBe(false); // array 入参（无一匹配）
    });
  });

  describe('setUser', () => {
    it('set 后 store 与 localStorage 同步', () => {
      const store = useUserStore();
      const u = { id: 7, username: 'sales01', isAdmin: false, permissions: ['p1'] };
      store.setUser(u);
      expect(store.user).toEqual(u);
      expect(localStorage.getItem('user')).toContain('sales01');
    });
  });

  describe('logout', () => {
    it('清空 store + 清 localStorage', () => {
      const store = useUserStore();
      store.setUser({ id: 1, username: 'a', isAdmin: true, permissions: ['p'] });
      expect(store.user.username).toBe('a');
      store.logout();
      expect(store.user).toEqual({});
      expect(store.permissions).toEqual([]);
      expect(store.isAdmin).toBe(false);
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});
