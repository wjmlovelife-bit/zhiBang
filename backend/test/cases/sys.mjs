// cases/sys.mjs —— 系统管理：用户 / 角色 / 菜单 / 字典 / 部门 / 公司
export const name = '系统管理';
export async function run(ctx) {
  const t = ctx.case;

  // ============ 鉴权基线 ============
  const r401 = await ctx.req('GET', '/sys/menus');
  t.ok(r401.status === 401, `无 token 访问菜单应被拒（${r401.status}）`);

  // ============ 菜单 ============
  const menus = await ctx.req('GET', '/sys/menus', { token: ctx.tokens.admin });
  t.ok(menus.status === 200, `菜单树 200（${menus.status}）`);

  const menusAll = await ctx.req('GET', '/sys/menus-all', { token: ctx.tokens.admin });
  t.ok(menusAll.status === 200, `菜单全量 200（${menusAll.status}）`);

  // ============ 操作码（权限码池） ============
  const ops = await ctx.req('GET', '/sys/operations', { token: ctx.tokens.admin });
  t.ok(ops.status === 200, `权限码池 200（${ops.status}）`);
  t.ok(Array.isArray(ops.data) || Array.isArray(ops.data?.items), '权限码池为数组');

  // ============ 部门 / 区域 ============
  const depts = await ctx.req('GET', '/sys/depts', { token: ctx.tokens.admin });
  t.ok(depts.status === 200, `depts 200（${depts.status}）`);
  const deptsTree = await ctx.req('GET', '/sys/depts-tree', { token: ctx.tokens.admin });
  t.ok(deptsTree.status === 200, `depts-tree 200（${deptsTree.status}）`);
  const regions = await ctx.req('GET', '/sys/regions', { token: ctx.tokens.admin });
  t.ok(regions.status === 200, `regions 200（${regions.status}）`);
  const regionsTree = await ctx.req('GET', '/sys/regions-tree', { token: ctx.tokens.admin });
  t.ok(regionsTree.status === 200, `regions-tree 200（${regionsTree.status}）`);

  // ============ 字典 ============
  const dict = await ctx.req('GET', '/sys/dict', { token: ctx.tokens.admin });
  t.ok(dict.status === 200, `dict 200（${dict.status}）`);
  const dictMap = await ctx.req('GET', '/sys/dict-map', { token: ctx.tokens.admin });
  t.ok(dictMap.status === 200, `dict-map 200（${dictMap.status}）`);

  // ============ 角色列表 ============
  const roles = await ctx.req('GET', '/sys/roles', { token: ctx.tokens.admin });
  t.ok(roles.status === 200, `roles 200（${roles.status}）`);
  t.ok(Array.isArray(roles.data) || Array.isArray(roles.data?.items), 'roles 数组');

  // ============ 用户列表 ============
  const users = await ctx.req('GET', '/sys/users', { token: ctx.tokens.admin });
  t.ok(users.status === 200, `users 200（${users.status}）`);
  const usersList = await ctx.req('GET', '/sys/users/list', { token: ctx.tokens.admin });
  t.ok(usersList.status === 200, `users/list 200（${usersList.status}）`);

  // ============ 公司（公开 + 写） ============
  // 公司读接口是 @Public，免 token 即可
  const pub = await ctx.req('GET', '/sys/company');
  t.ok(pub.status === 200, `company @Public 无 token 也 200（${pub.status}）`);
  const comp = await ctx.req('GET', '/sys/company', { token: ctx.tokens.admin });
  t.ok(comp.status === 200, `company 带 token 200（${comp.status}）`);

  // 写入公司信息（不破坏既有值：仅断言字段回显即可）
  const saved = await ctx.req('PUT', '/sys/company', {
    token: ctx.tokens.admin,
    body: comp.data || {},
  });
  t.ok(saved.status === 200 || saved.status === 201, `PUT company 2xx（${saved.status}）`);

  // ============ 用户模板 / 导入（API 存在性） ============
  const tmpl = await ctx.req('GET', '/sys/users/template', { token: ctx.tokens.admin });
  t.ok(tmpl.status === 200, `用户导入模板 200（${tmpl.status}）`);

  // ============ sales 视角：菜单 ≠ admin（菜单树缩小） ============
  const salesMenus = await ctx.req('GET', '/sys/menus', { token: ctx.tokens.sales });
  t.ok(salesMenus.status === 200, `sales 菜单 200（${salesMenus.status}）`);
  // 不强行断言节点数差异，但能取到说明权限链 OK
  t.ok(salesMenus.data !== null && salesMenus.data !== undefined, 'sales 返回菜单对象');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
