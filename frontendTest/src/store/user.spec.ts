/**
 * store/user.ts 真实测试
 *
 * 来源：`D:\github\xiangmutest\opencode\zhibang\frontend\src\store\user.ts`
 * 覆盖：
 *  - state 初值（从 localStorage 读 user）
 *  - hasPerm getter：admin / 普通用户 / 多权限
 *  - setUser action：更新所有 state + localStorage
 *  - setMenus action：仅更新 menus
 *  - logout action：清 localStorage + state
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/user';

describe('store/user', () => {
  beforeEach(() => {
    localStorage.clear();
    // 关键：每次测试都新建 pinia 实例并激活
    // 注：必须设 _testing=true 绕过 pinia v2 的 `test 模式 pinia=null` 判断
    // （否则 useStore() 内部 line 1730 会把 pinia 设成 null 并抛"no active Pinia"）
    const pinia = createPinia();
    pinia._testing = true;
    setActivePinia(pinia);
  });

  describe('state 初值', () => {
    it('1. localStorage 无 user → 全默认', () => {
      const store = useUserStore();
      expect(store.user).toEqual({});
      expect(store.menus).toEqual([]);
      expect(store.permissions).toEqual([]);
      expect(store.isAdmin).toBe(false);
      expect(store.roleCodes).toEqual([]);
      expect(store.dataScope).toBe(4);
    });

    it('2. localStorage 有 user → 从 localStorage 读', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', isAdmin: true, permissions: ['user:create'],
        roleCodes: ['admin'], dataScope: 1,
      }));
      const store = useUserStore();
      expect(store.user.id).toBe(1);
      expect(store.isAdmin).toBe(true);
      expect(store.permissions).toEqual(['user:create']);
      expect(store.dataScope).toBe(1);
    });

    it('3. ⚠ 行为记录：localStorage 非法 JSON → JSON.parse 抛 SyntaxError（源码 bug 未 try/catch）', () => {
      // 源码 store/user.ts:5 `JSON.parse(localStorage.getItem('user') || '{}')` 未包 try/catch
      // 当 localStorage 中是 'INVALID' 时，state 工厂函数抛错 → useStore 失败
      // 这是源码 bug，应在源码处加 try/catch fallback 返回 {}
      localStorage.setItem('user', 'INVALID');
      expect(() => useUserStore()).toThrow(SyntaxError);
    });
  });

  describe('hasPerm', () => {
    it('4. admin 永远 true', () => {
      localStorage.setItem('user', JSON.stringify({ id: 1, isAdmin: true, permissions: [] }));
      const store = useUserStore();
      expect(store.hasPerm('any:code')).toBe(true);
    });

    it('5. 非 admin + 命中 → true', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, isAdmin: false, permissions: ['user:create'] }));
      const store = useUserStore();
      expect(store.hasPerm('user:create')).toBe(true);
    });

    it('6. 非 admin + 不命中 → false', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, isAdmin: false, permissions: ['user:create'] }));
      const store = useUserStore();
      expect(store.hasPerm('user:delete')).toBe(false);
    });

    it('7. 数组形式：任一命中 → true', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, isAdmin: false, permissions: ['user:create'] }));
      const store = useUserStore();
      expect(store.hasPerm(['user:delete', 'user:create'])).toBe(true);
    });

    it('8. 数组形式：全不命中 → false', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, isAdmin: false, permissions: ['other'] }));
      const store = useUserStore();
      expect(store.hasPerm(['a', 'b'])).toBe(false);
    });

    it('9. 空字符串 → false', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, isAdmin: false, permissions: ['user:create'] }));
      const store = useUserStore();
      expect(store.hasPerm('')).toBe(false);
    });
  });

  describe('actions', () => {
    it('10. setUser：更新所有字段 + localStorage', () => {
      const store = useUserStore();
      store.setUser({
        id: 5, username: 'sales01', name: '张三',
        isAdmin: false, permissions: ['customer:view'],
        roleCodes: ['sales'], dataScope: 4, mustResetPassword: false,
      });
      expect(store.user.id).toBe(5);
      expect(store.permissions).toEqual(['customer:view']);
      expect(store.isAdmin).toBe(false);
      expect(store.roleCodes).toEqual(['sales']);
      expect(store.dataScope).toBe(4);
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      expect(stored.id).toBe(5);
    });

    it('11. setUser：缺字段时默认值', () => {
      const store = useUserStore();
      store.setUser({ id: 1, name: 'X' });
      expect(store.permissions).toEqual([]);
      expect(store.isAdmin).toBe(false);
      expect(store.roleCodes).toEqual([]);
      expect(store.dataScope).toBe(4);
    });

    it('12. setMenus：仅更新 menus', () => {
      const store = useUserStore();
      store.setMenus([{ id: 1, name: '客户' }, { id: 2, name: '项目' }]);
      expect(store.menus).toHaveLength(2);
    });

    it('13. logout：清 localStorage + state 重置', () => {
      localStorage.setItem('token', 'abc');
      localStorage.setItem('user', JSON.stringify({ id: 1, isAdmin: true }));
      const store = useUserStore();
      store.logout();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(store.user).toEqual({});
      expect(store.menus).toEqual([]);
      expect(store.permissions).toEqual([]);
      expect(store.isAdmin).toBe(false);
      expect(store.roleCodes).toEqual([]);
      expect(store.dataScope).toBe(4);
    });
  });

  describe('并发安全行为记录', () => {
    it('14. 多次 setUser 顺序覆盖（无 race condition）', () => {
      const store = useUserStore();
      store.setUser({ id: 1, name: 'A', isAdmin: true });
      store.setUser({ id: 2, name: 'B', isAdmin: false });
      expect(store.user.id).toBe(2);
      expect(store.isAdmin).toBe(false);
    });

    it('15. logout → setUser 循环 OK', () => {
      const store = useUserStore();
      store.setUser({ id: 1, name: 'A', isAdmin: true });
      store.logout();
      store.setUser({ id: 2, name: 'B', isAdmin: false });
      expect(store.user.id).toBe(2);
    });
  });
});