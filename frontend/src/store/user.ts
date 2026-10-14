import { defineStore } from 'pinia';

// 安全从 localStorage 读取 user JSON：
// 1) localStorage 可能不存在该 key（getItem 返回 null）
// 2) 可能存了 'null' 字符串（旧代码 setItem('user', null) 会存 'null'）
// 3) 可能存了非法 JSON
// 这三种情况都返回 {}，避免 state 工厂抛 "Cannot read properties of undefined"
function readStoredUser(): any {
  const raw = localStorage.getItem('user');
  if (!raw || raw === 'null' || raw === 'undefined') return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export const useUserStore = defineStore('user', {
  state: () => {
    const u = readStoredUser();
    return {
      user: u,
      menus: [] as any[],
      permissions: (u.permissions || []) as string[],
      isAdmin: !!u.isAdmin,
      roleCodes: (u.roleCodes || []) as string[],
      dataScope: (u.dataScope ?? 4) as number,
    };
  },
  getters: {
    // 是否拥有某个操作权限（管理员直接放行）
    hasPerm: (state) => (code: string | string[]) => {
      if (state.isAdmin) return true;
      const codes = Array.isArray(code) ? code : [code];
      const own = state.permissions || [];
      return codes.some((c) => own.includes(c));
    },
  },
  actions: {
    setUser(u: any) {
      this.user = u;
      this.permissions = u.permissions || [];
      this.isAdmin = !!u.isAdmin;
      this.roleCodes = u.roleCodes || [];
      this.dataScope = u.dataScope ?? 4;
      localStorage.setItem('user', JSON.stringify(u));
    },
    setMenus(m: any[]) {
      this.menus = m;
    },
    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      this.user = {};
      this.menus = [];
      this.permissions = [];
      this.isAdmin = false;
      this.roleCodes = [];
      this.dataScope = 4;
    },
  },
});