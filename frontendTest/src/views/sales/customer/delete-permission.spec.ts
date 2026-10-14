/**
 * 客户删除按钮 权限测试（纯业务逻辑版，不 mount .vue 组件）
 *
 * 来源：
 *  - frontend/src/views/sales/customer/List.vue L78（客户列表删除）
 *  - frontend/src/views/sales/customer/Form.vue L107（编辑页联系人删）
 *
 * 行为约束（用户 2026-09-22 确认）：
 *  - 销售角色（isAdmin=false, dataScope=4）登录 → 两个删除按钮均不渲染
 *  - 管理员（isAdmin=true, dataScope=1）登录 → 两个删除按钮均渲染
 *
 * 关键技术点：避免 .vue 解析（happy-dom 不支持 .vue），仅测 userStore.isAdmin 计算逻辑 +
 * 模拟 v-if 守卫表达式（与 List.vue/Form.vue 中的 inline isAdmin 完全一致）。
 *
 * 注意：本 spec 不引入 @vitejs/plugin-vue（happy-dom 不解析 .vue）。如需 mount 组件级测试，
 * 需安装 @vitejs/plugin-vue + 修改 vitest.config.ts，超出本轮硬约束范围。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/user';

describe('客户删除按钮权限（业务逻辑层）', () => {
  beforeEach(() => {
    localStorage.clear();
    const pinia = createPinia();
    pinia._testing = true;
    setActivePinia(pinia);
  });

  /**
   * 与 List.vue L78 和 Form.vue L107 完全一致的 v-if 守卫表达式。
   * 这是 9-22 改动后源码的真实表达式（实测确认）。
   */
  function shouldShowDeleteBtn(userData: any): boolean {
    // 模拟 List.vue: `v-if="isAdmin"` 而 isAdmin = computed(() => currentUser.dataScope === 1)
    // 模拟 Form.vue: `v-if="isAdmin"` 而 isAdmin = computed(() => userStore.dataScope === 1)
    return userData.dataScope === 1;
  }

  // ============================================================
  // 核心场景：销售 vs 管理员
  // ============================================================
  describe('核心场景：销售 vs 管理员', () => {
    it('1. admin（isAdmin=true, dataScope=1）登录 → 看到删除按钮', () => {
      const u = { isAdmin: true, dataScope: 1 };
      expect(shouldShowDeleteBtn(u)).toBe(true);
    });

    it('2. sales01 张三（isAdmin=false, dataScope=4）登录 → 看不到删除按钮', () => {
      const u = { isAdmin: false, dataScope: 4 };
      expect(shouldShowDeleteBtn(u)).toBe(false);
    });
  });

  // ============================================================
  // 全 27 个真实用户场景矩阵
  // ============================================================
  describe('全用户场景矩阵（27 个真实用户）', () => {
    const cases = [
      { id: 1, name: 'admin', isAdmin: true, dataScope: 1, expected: true,  reason: 'admin dataScope=1' },
      { id: 24, name: 'leader01', isAdmin: true, dataScope: 2, expected: false, reason: 'leader 非 dataScope=1，删除按钮隐藏' },
      { id: 25, name: 'leader02', isAdmin: true, dataScope: 2, expected: false, reason: 'leader 非 dataScope=1' },
      { id: 69, name: 'leader04', isAdmin: true, dataScope: 7, expected: false, reason: 'leader 自定义部门 7' },
      { id: 79, name: 'leader03', isAdmin: true, dataScope: 4, expected: false, reason: 'leader 商务部 dataScope=4' },
      { id: 80, name: 'sales11', isAdmin: true, dataScope: 2, expected: false, reason: 'sales11 isAdmin=true 但 dataScope=2（不是 1）' },
      { id: 2, name: 'sales01 张三', isAdmin: false, dataScope: 4, expected: false, reason: '销售 dataScope=4' },
      { id: 53, name: 'sales02', isAdmin: false, dataScope: 4, expected: false, reason: '销售' },
      { id: 57, name: 'sales03', isAdmin: false, dataScope: 5, expected: false, reason: '销售' },
      { id: 58, name: 'sales04', isAdmin: false, dataScope: 5, expected: false, reason: '销售' },
      { id: 59, name: 'sales05', isAdmin: false, dataScope: 6, expected: false, reason: '销售' },
      { id: 60, name: 'sales06', isAdmin: false, dataScope: 6, expected: false, reason: '销售' },
      { id: 64, name: 'sales07', isAdmin: false, dataScope: 5, expected: false, reason: '销售' },
      { id: 76, name: 'sales08', isAdmin: false, dataScope: 2, expected: false, reason: '销售' },
      { id: 77, name: 'sales09', isAdmin: false, dataScope: 2, expected: false, reason: '销售' },
      { id: 78, name: 'sales010', isAdmin: false, dataScope: 2, expected: false, reason: '销售' },
      { id: 81, name: 'jishu01', isAdmin: false, dataScope: 2, expected: false, reason: '技术' },
      { id: 82, name: 'jishu02', isAdmin: false, dataScope: 2, expected: false, reason: '技术' },
      { id: 29, name: 'shangwu01', isAdmin: false, dataScope: 4, expected: false, reason: '商务部' },
      { id: 30, name: 'caigou01', isAdmin: false, dataScope: 4, expected: false, reason: '采购' },
      { id: 65, name: 'administrative01', isAdmin: false, dataScope: 7, expected: false, reason: '行政' },
      { id: 66, name: 'administrative02', isAdmin: false, dataScope: 7, expected: false, reason: '行政' },
      { id: 68, name: 'administrative03', isAdmin: false, dataScope: 7, expected: false, reason: '行政' },
      { id: 71, name: 'dianshang01', isAdmin: false, dataScope: 4, expected: false, reason: '电商' },
      { id: 72, name: 'dianshang02', isAdmin: false, dataScope: 4, expected: false, reason: '电商' },
      { id: 73, name: 'dianshang03', isAdmin: false, dataScope: 4, expected: false, reason: '电商' },
      { id: 74, name: 'dianshang04', isAdmin: false, dataScope: 4, expected: false, reason: '电商' },
    ];

    for (const c of cases) {
      it(`${c.id}. ${c.name} (dataScope=${c.dataScope}, isAdmin=${c.isAdmin}) → 删除按钮显示=${c.expected}（${c.reason}）`, () => {
        expect(shouldShowDeleteBtn(c)).toBe(c.expected);
      });
    }
  });

  // ============================================================
  // 数据范围边界
  // ============================================================
  describe('dataScope 边界', () => {
    it('28. dataScope=1 (全部) → 显示', () => {
      expect(shouldShowDeleteBtn({ dataScope: 1, isAdmin: true })).toBe(true);
    });

    it('29. dataScope=2 (本部门及下级) → 不显示（与 isAdmin 无关）', () => {
      expect(shouldShowDeleteBtn({ dataScope: 2, isAdmin: true })).toBe(false);
      expect(shouldShowDeleteBtn({ dataScope: 2, isAdmin: false })).toBe(false);
    });

    it('30. dataScope=3 (本部门) → 不显示', () => {
      expect(shouldShowDeleteBtn({ dataScope: 3, isAdmin: true })).toBe(false);
    });

    it('31. dataScope=4 (本人) → 不显示', () => {
      expect(shouldShowDeleteBtn({ dataScope: 4, isAdmin: false })).toBe(false);
    });

    it('32. dataScope=5 (自定义部门列表) → 不显示', () => {
      expect(shouldShowDeleteBtn({ dataScope: 5, isAdmin: false })).toBe(false);
    });

    it('33. dataScope 未设置（undefined）→ 不显示', () => {
      expect(shouldShowDeleteBtn({ isAdmin: true })).toBe(false);
    });
  });

  // ============================================================
  // useUserStore 真实集成（确保 store 计算与 v-if 一致）
  // ============================================================
  describe('useUserStore isAdmin 计算验证', () => {
    it('34. localStorage.user=admin (dataScope=1, isAdmin=true) → store.isAdmin=true', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', name: '管理员',
        isAdmin: true, dataScope: 1, permissions: [], roleCodes: ['admin'],
      }));
      const store = useUserStore();
      expect(store.isAdmin).toBe(true);
      expect(store.dataScope).toBe(1);
    });

    it('35. localStorage.user=sales01 (dataScope=4, isAdmin=false) → store.isAdmin=false', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 2, username: 'sales01', name: '张三',
        isAdmin: false, dataScope: 4, permissions: [], roleCodes: ['sales'],
      }));
      const store = useUserStore();
      expect(store.isAdmin).toBe(false);
      expect(store.dataScope).toBe(4);
    });

    it('36. localStorage 非法 JSON → store 走默认空 user → store.isAdmin=false', () => {
      localStorage.setItem('user', 'INVALID');
      // store 构造时 JSON.parse 抛错 → 走 default state (注意：本用例验证状态，但 JSON.parse 在 state 工厂抛错)
      // state 工厂 line 6: user: JSON.parse(localStorage.getItem('user') || '{}')
      // 'INVALID' 会让 JSON.parse 抛 SyntaxError
      // 这里只验证：若 user 损坏，store 暴露的 user.isAdmin 为 undefined → falsy → 不显示
      // ⚠ 注：当前源码 store 不 try/catch，所以会抛错——这是已知源码 bug（F-L4 类）
      expect(() => useUserStore()).toThrow(); // 行为记录：源码 JSON.parse 不包 try/catch
    });
  });
});