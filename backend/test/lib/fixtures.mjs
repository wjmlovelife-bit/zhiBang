// fixtures.mjs —— 权限码驱动的测试基础设施（抗菜单/权限变更的关键）
//
// 设计思路：
// 1. SCENARIOS：登录账号集合，账号名/密码改了只动这里
// 2. NEED：业务动作 → 权限码映射，权限码名改了只动这里
// 3. makeCtx：构造与旧 runner 兼容的 ctx（保留 req/login/tokens/users）
// 4. assertCanReq / assertCannotReq：权限码断言
// 5. makeTestId：临时数据 ID（不污染真实业务数据）
//
// 任何后续菜单 / 权限码重命名 / 加新模块，只动这一份文件即可。

import { req, login, BASE } from './http.mjs';

// ====================== 账号场景 ======================

export const SCENARIOS = {
  admin: { username: 'admin', password: '123456', desc: '数据全量' },
  sales: { username: 'sales01', password: '123456', desc: '数据范围 = 自己' },
};

// ====================== 业务动作 → 权限码 ======================
// 改了这里的 key 或后面权限码值时，跑测试如果权限不匹配会给提示，便于一次性同步更新

export const NEED = {
  // customer（客户）
  'customer.list':       'customer:view',
  'customer.create':     'customer:create',
  'customer.update':     'customer:update',
  'customer.delete':     'customer:delete',
  'customer.inherit':    'customer:inherit',
  'customer.follow':     'customer:follow',
  'customer.import':     'customer:import',
  'customer.export':     'customer:export',

  // project（项目）
  'project.list':        'project:view',
  'project.create':      'project:create',
  'project.update':      'project:update',
  'project.delete':      'project:delete',
  'project.inherit':     'project:inherit',
  'project.follow':      'project:follow',

  // opportunity（商机）
  'opportunity.list':    'opportunity:view',
  'opportunity.create':  'opportunity:create',
  'opportunity.update':  'opportunity:update',
  'opportunity.delete':  'opportunity:delete',
  'opportunity.pdf':     'opportunity:pdf',

  // quotation（报价）
  'quotation.list':      'quotation:view',
  'quotation.create':    'quotation:create',
  'quotation.update':    'quotation:update',
  'quotation.delete':    'quotation:delete',
  'quotation.pdf':       'quotation:pdf',

  // contract（合同）
  'contract.list':       'contract:view',
  'contract.create':     'contract:create',
  'contract.update':     'contract:update',
  'contract.delete':     'contract:delete',
  'contract.pdf':        'contract:pdf',

  // worklog（工作日志）
  'worklog.list':        'worklog:view',
  'worklog.create':      'worklog:create',
  'worklog.update':      'worklog:update',
  'worklog.delete':      'worklog:delete',
  'worklog.weekly':      'worklog:weekly',
  'worklog.daily':       'worklog:daily',

  // sys（系统管理：用户/角色/菜单/公司）
  'sys.user.list':       'user:list',
  'sys.user.update':     'user:update',
  'sys.role.list':       'role:list',
  'sys.role.update':     'role:update',
  'sys.menu.list':       'menu:view',
  'sys.menu.update':     'menu:update',
  'sys.company.read':    'company:view',
  'sys.company.update':  'company:update',

  // upload（附件）
  'upload.image':        'upload:create',
  'upload.read':         'upload:read',
};

// ====================== 工具函数 ======================

/** 一键登录所有 SCENARIOS，返回 { admin: {token,user,status}, sales: {...} } */
export async function loginAll() {
  const out = {};
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const r = await login(sc.username, sc.password);
    out[name] = { token: r.token || null, user: r.user || null, status: r.status, raw: r.raw };
    if (!r.token) {
      console.error(`[fixtures] 登录场景 ${name} (${sc.username}) 失败：status=${r.status}，检查后端可达 + 账号存在`);
    }
  }
  return out;
}

/** 构造与旧 runner 兼容的 ctx，同时注入 NEED 表 */
export function makeCtx(allTokens) {
  return {
    req,
    login,
    tokens: Object.fromEntries(Object.entries(allTokens).map(([k, v]) => [k, v.token])),
    users: Object.fromEntries(Object.entries(allTokens).map(([k, v]) => [k, v.user])),
    NEED,
    SCENARIOS,
  };
}

/** 权限码正向断言：指定 scope 应该能调用此 API（status 200/2xx） */
export async function assertCanReq(c, scope, method, path, body, expectOk = true) {
  const r = await req(method, path, { token: c.tokens[scope], body });
  if (expectOk && (r.status < 200 || r.status >= 300)) {
    throw new Error(`权限断言失败：${scope}@${method} ${path} 期望 2xx 但拿到 ${r.status}（${JSON.stringify(r.data).slice(0, 120)}）`);
  }
  return r;
}

/** 权限码反向断言：指定 scope 应该被拒（默认 403；登录失效则为 401） */
export async function assertForbiddenReq(c, scope, method, path, body) {
  const r = await req(method, path, { token: c.tokens[scope], body });
  if (r.status !== 401 && r.status !== 403) {
    throw new Error(`越权断言失败：${scope}@${method} ${path} 期望 401/403 但拿到 ${r.status}`);
  }
  return r;
}

/** 为本次跑生成测试数据 ID，避免污染真实数据 */
export function makeTestId(tag = '') {
  const stamp = Date.now().toString(36).slice(-6);
  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return (tag ? tag + '_' : '') + stamp + '_' + rnd;
}

/** 列出所有 NEED 的权限码（用于报告覆盖率） */
export function listAllPermissionCodes() {
  return Array.from(new Set(Object.values(NEED))).sort();
}
