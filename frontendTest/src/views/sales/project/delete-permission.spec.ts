/**
 * 项目列表删除按钮 权限测试（纯业务逻辑版，不 mount .vue 组件）
 *
 * 来源：
 *  - frontend/src/views/sales/project/List.vue L82（项目列表删除按钮，v-if="isAdmin"）
 *  - frontend/src/views/sales/project/List.vue L156（isAdmin = computed(() => currentUser.dataScope === 1)）
 *
 * 行为约束（用户 2026-09-22 确认，同源客户删除权限需求）：
 *  - 销售/leader/技术等角色（dataScope≠1）登录 → 项目列表删除按钮不渲染
 *  - 管理员（dataScope=1）登录 → 删除按钮渲染
 *
 * 关键技术点：避免 .vue 解析（happy-dom 不支持 .vue），仅测 isAdmin 计算逻辑 +
 * 模拟 v-if 守卫表达式（与 List.vue 中的 inline isAdmin 完全一致）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/user';

describe('项目列表删除按钮权限（业务逻辑层）', () => {
  beforeEach(() => {
    localStorage.clear();
    const pinia = createPinia();
    pinia._testing = true;
    setActivePinia(pinia);
  });

  /**
   * 与 project/List.vue L82 + L156 完全一致的 v-if 守卫表达式。
   * 源码：const isAdmin = computed(() => currentUser.dataScope === 1)
   */
  function shouldShowDeleteBtn(userData: any): boolean {
    return userData.dataScope === 1;
  }

  // ============================================================
  // 核心场景：销售 vs 管理员
  // ============================================================
  describe('核心场景：销售 vs 管理员', () => {
    it('1. admin（dataScope=1）登录 → 看到删除按钮', () => {
      const u = { dataScope: 1, isAdmin: true };
      expect(shouldShowDeleteBtn(u)).toBe(true);
    });

    it('2. sales01 张三（dataScope=4）登录 → 看不到删除按钮', () => {
      const u = { dataScope: 4, isAdmin: false };
      expect(shouldShowDeleteBtn(u)).toBe(false);
    });
  });

  // ============================================================
  // 全 27 个真实用户场景矩阵（与客户同源，角色权限一致）
  // ============================================================
  describe('全用户场景矩阵（27 个真实用户）', () => {
    const cases = [
      { id: 1, name: 'admin', isAdmin: true, dataScope: 1, expected: true,  reason: 'admin dataScope=1' },
      { id: 24, name: 'leader01', isAdmin: true, dataScope: 2, expected: false, reason: 'leader 非 dataScope=1' },
      { id: 25, name: 'leader02', isAdmin: true, dataScope: 2, expected: false, reason: 'leader 非 dataScope=1' },
      { id: 69, name: 'leader04', isAdmin: true, dataScope: 7, expected: false, reason: 'leader 自定义部门 7' },
      { id: 79, name: 'leader03', isAdmin: true, dataScope: 4, expected: false, reason: 'leader 商务部 dataScope=4' },
      { id: 80, name: 'sales11', isAdmin: true, dataScope: 2, expected: false, reason: 'sales11 isAdmin=true 但 dataScope=2' },
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
  // dataScope 边界
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
  // 与前端真实数据源一致：localStorage 'user' 解析后 isAdmin 计算
  // project/List.vue 直接读 localStorage.getItem('user')，再算 dataScope===1
  // ============================================================
  describe('localStorage user → isAdmin 计算一致性', () => {
    function isAdminFromStorage(): boolean {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return currentUser.dataScope === 1;
    }

    it('34. localStorage.user=admin (dataScope=1) → isAdmin=true', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', name: '管理员',
        isAdmin: true, dataScope: 1, permissions: [], roleCodes: ['admin'],
      }));
      expect(isAdminFromStorage()).toBe(true);
    });

    it('35. localStorage.user=sales01 (dataScope=4) → isAdmin=false', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 2, username: 'sales01', name: '张三',
        isAdmin: false, dataScope: 4, permissions: [], roleCodes: ['sales'],
      }));
      expect(isAdminFromStorage()).toBe(false);
    });

    it('36. localStorage 无 user → 默认 {} → isAdmin=false', () => {
      expect(isAdminFromStorage()).toBe(false);
    });

    it('37. useUserStore 与 v-if 表达式一致（admin）', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', name: '管理员',
        isAdmin: true, dataScope: 1, permissions: [], roleCodes: ['admin'],
      }));
      const store = useUserStore();
      expect(store.isAdmin).toBe(true);
      expect(store.dataScope).toBe(1);
    });

    it('38. useUserStore 与 v-if 表达式一致（sales）', () => {
      localStorage.setItem('user', JSON.stringify({
        id: 2, username: 'sales01', name: '张三',
        isAdmin: false, dataScope: 4, permissions: [], roleCodes: ['sales'],
      }));
      const store = useUserStore();
      expect(store.isAdmin).toBe(false);
      expect(store.dataScope).toBe(4);
    });
  });
});
