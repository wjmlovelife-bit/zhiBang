// 权限管理功能：登录权限载荷 / @Permissions 守卫拦截 / 用户操作授权(授予单位=用户)
// / 角色模板 / 应用角色模板 / 数据范围(dataScope) / Excel 模板下载 / 部门·菜单全量
// 设计原则：仅创建带时间戳的临时用户/角色，测试后清理，seed 数据不被破坏。
export const name = '权限管理';
export async function run(ctx) {
  const t = ctx.case;
  const at = ctx.tokens.admin; // admin token
  const st = ctx.tokens.sales; // sales01 token
  const salesId = ctx.users.sales.id || 2;
  const ts = Date.now();

  const freshLogin = async (u, p) => {
    const r = await ctx.login(u, p);
    return r.user && r.user.permissions ? r.user.permissions : [];
  };

  // ---------- A. 登录权限载荷 ----------
  const aLogin = await ctx.login('admin', '112233');
  t.ok(aLogin.status === 200 || aLogin.status === 201, `admin 登录成功（${aLogin.status}）`);
  t.ok(aLogin.user && aLogin.user.isAdmin === true, 'admin 登录载荷 isAdmin=true');
  t.ok(Array.isArray(aLogin.user.permissions) && aLogin.user.permissions.length > 0, `admin 返回权限集合（${aLogin.user.permissions.length} 个）`);
  const aPerms = aLogin.user.permissions;

  const sLogin = await ctx.login('sales01', '123456');
  t.ok(sLogin.user && sLogin.user.isAdmin === false, 'sales01 登录载荷 isAdmin=false');
  const sPerms = sLogin.user.permissions || [];
  t.ok(!sPerms.includes('user:view'), 'sales01 默认不含系统管理码 user:view（授予前）');

  const bad = await ctx.login('admin', 'wrong-pass');
  t.ok(bad.status === 401 || bad.status === 400, `错误密码被拒绝（${bad.status}）`);

  // ---------- B. @Permissions 守卫拦截 ----------
  const sRoles = await ctx.req('GET', '/sys/roles', { token: st });
  t.ok(sRoles.status === 403, `sales01 访问 /sys/roles 被守卫拦截（${sRoles.status}=403）`);
  const aRoles = await ctx.req('GET', '/sys/roles', { token: at });
  t.ok(aRoles.status === 200 && Array.isArray(aRoles.data), `admin 访问 /sys/roles 通过（${aRoles.status}）`);

  const sUsersList = await ctx.req('GET', '/sys/users/list', { token: st });
  t.ok(sUsersList.status === 403, `sales01 访问 /sys/users/list 被拦截（${sUsersList.status}=403，授予前）`);
  const aUsersList = await ctx.req('GET', '/sys/users/list?page=1&pageSize=5', { token: at });
  t.ok(aUsersList.status === 200 && typeof aUsersList.data.total === 'number', `admin 访问 /sys/users/list 通过（total=${aUsersList.data.total}）`);

  const sOps = await ctx.req('GET', '/sys/operations', { token: st });
  t.ok(sOps.status === 403, `sales01 访问 /sys/operations 被拦截（${sOps.status}=403）`);
  const aOps = await ctx.req('GET', '/sys/operations', { token: at });
  t.ok(aOps.status === 200 && Array.isArray(aOps.data), `admin 访问 /sys/operations 通过（${aOps.data.length} 条目录）`);

  // ---------- C. 用户操作授权（授予单位=用户） ----------
  // 守卫先放行 user:assign（admin 拥有），再改 sales01 的直接授权
  const grant = await ctx.req('PUT', `/sys/users/${salesId}/operations`, { token: at, body: { codes: ['user:view'] } });
  t.ok(grant.status === 200 && grant.data.count === 1, `admin 授予 sales01 操作 user:view（count=${grant.data.count}）`);

  let sPermsAfter = await freshLogin('sales01', '123456');
  t.ok(sPermsAfter.includes('user:view'), 'sales01 重新登录后 permissions 含 user:view');

  const sUsersList2 = await ctx.req('GET', '/sys/users/list', { token: st });
  t.ok(sUsersList2.status === 200, `sales01 获授权后 /sys/users/list 通过（${sUsersList2.status}）`);

  // 撤销并校验恢复
  const revoke = await ctx.req('PUT', `/sys/users/${salesId}/operations`, { token: at, body: { codes: [] } });
  t.ok(revoke.status === 200 && revoke.data.count === 0, `admin 撤销 sales01 操作授权（count=${revoke.data.count}）`);
  sPermsAfter = await freshLogin('sales01', '123456');
  t.ok(!sPermsAfter.includes('user:view'), 'sales01 撤销后权限恢复（不含 user:view）');
  const sUsersList3 = await ctx.req('GET', '/sys/users/list', { token: st });
  t.ok(sUsersList3.status === 403, `sales01 撤销后 /sys/users/list 恢复拦截（${sUsersList3.status}=403）`);

  // ---------- D. 角色操作/菜单模板 ----------
  const roleCreate = await ctx.req('POST', '/sys/roles', {
    token: at,
    body: { code: `ptest_role_${ts}`, name: '权限测试临时角色', dataScope: 4, isSystem: false },
  });
  t.ok(roleCreate.status === 201 || roleCreate.status === 200, `创建临时角色（${roleCreate.status}）`);
  const roleId = roleCreate.data && roleCreate.data.id;
  t.ok(!!roleId, `临时角色 id=${roleId}`);

  if (roleId) {
    const setROps = await ctx.req('PUT', `/sys/roles/${roleId}/operations`, { token: at, body: { codes: ['crm:customer:view', 'contract:view'] } });
    t.ok(setROps.status === 200 && setROps.data.count === 2, `设置角色操作模板（count=${setROps.data.count}）`);
    const getROps = await ctx.req('GET', `/sys/roles/${roleId}/operations`, { token: at });
    t.ok(getROps.status === 200 && Array.isArray(getROps.data) && getROps.data.includes('crm:customer:view'), `读取角色操作模板含 crm:customer:view（${JSON.stringify(getROps.data)}）`);

    const setRMenus = await ctx.req('PUT', `/sys/roles/${roleId}/menus`, { token: at, body: { menuIds: [101, 102] } });
    t.ok(setRMenus.status === 200 && setRMenus.data.count === 2, `设置角色菜单模板（count=${setRMenus.data.count}）`);
    const getRMenus = await ctx.req('GET', `/sys/roles/${roleId}/menus`, { token: at });
    t.ok(getRMenus.status === 200 && Array.isArray(getRMenus.data) && getRMenus.data.includes(101), `读取角色菜单模板含 101（${JSON.stringify(getRMenus.data)}）`);

    const delRole = await ctx.req('DELETE', `/sys/roles/${roleId}`, { token: at });
    t.ok(delRole.status === 200, `删除临时角色（清理）（${delRole.status}）`);
  }

  // ---------- E. 用户菜单授权 + 应用角色模板（证明授予单位=用户） ----------
  const uCreate = await ctx.req('POST', '/sys/users', {
    token: at,
    body: { username: `ptest_${ts}`, name: '权限测试临时用户', password: '123456', roleIds: [] },
  });
  t.ok(uCreate.status === 201 || uCreate.status === 200, `创建临时用户（${uCreate.status}）`);
  const uid = uCreate.data && uCreate.data.id;
  t.ok(!!uid, `临时用户 id=${uid}`);

  if (uid) {
    // 先取 sales 角色 id（用于应用模板）
    const rolesAll = await ctx.req('GET', '/sys/roles', { token: at });
    const salesRole = (rolesAll.data || []).find((r) => r.code === 'sales');
    t.ok(!!salesRole, '找到 sales 角色（用于应用模板）');

    const setUMenus = await ctx.req('PUT', `/sys/users/${uid}/menus`, { token: at, body: { menuIds: [101, 102] } });
    t.ok(setUMenus.status === 200 && setUMenus.data.count === 2, `设置用户菜单授权（count=${setUMenus.data.count}）`);
    const getUMenus = await ctx.req('GET', `/sys/users/${uid}/menus`, { token: at });
    t.ok(getUMenus.status === 200 && Array.isArray(getUMenus.data) && getUMenus.data.includes(101), `读取用户菜单授权含 101（${JSON.stringify(getUMenus.data)}）`);

    if (salesRole) {
      const apply = await ctx.req('POST', `/sys/users/${uid}/apply-role/${salesRole.id}`, { token: at });
      t.ok((apply.status === 200 || apply.status === 201) && apply.data && apply.data.operationCount > 0, `应用角色模板到用户（operationCount=${apply.data && apply.data.operationCount}）`);
      // 关键：授予单位=用户 → 操作应以用户直接授权返回，而非角色回退
      const getUOps = await ctx.req('GET', `/sys/users/${uid}/operations`, { token: at });
      t.ok(getUOps.status === 200 && Array.isArray(getUOps.data) && getUOps.data.length > 0, `用户直接授权生效（${getUOps.data.length} 个操作，证明授予单位=用户）`);
    }

    // 软删除临时用户（清理）
    const delU = await ctx.req('DELETE', `/sys/users/${uid}`, { token: at });
    t.ok(delU.status === 200, `删除临时用户（清理）（${delU.status}）`);
  }

  // ---------- F. 数据范围 dataScope ----------
  const nc = await ctx.req('GET', '/customer/next-code', { token: at });
  const ccode = typeof nc.data === 'string' ? nc.data : 'KH' + ts;
  const cname = '权限测试客户_' + ts;
  const cCreate = await ctx.req('POST', '/customer', {
    token: at,
    body: { code: ccode, name: cname, category: '终端公司', followStage: '高', industry: '电子' },
  });
  t.ok(cCreate.status === 201 || cCreate.status === 200, `创建测试客户（${cCreate.status}）`);
  const cid = cCreate.data && cCreate.data.id;
  t.ok(!!cid, `测试客户 id=${cid}`);

  if (cid) {
    const aList = await ctx.req('GET', '/customer/list?page=1&pageSize=50', { token: at });
    const aIds = (aList.data.items || []).map((i) => i.id);
    t.ok(aIds.includes(cid), 'admin（dataScope=1 全部）列表可见该客户');

    const sList = await ctx.req('GET', '/customer/list?page=1&pageSize=50', { token: st });
    const sIds = (sList.data.items || []).map((i) => i.id);
    t.ok(!sIds.includes(cid), 'sales01（dataScope=4 本人）列表不可见 admin 创建客户');
    t.ok((aList.data.total || 0) >= (sList.data.total || 0), `数据范围生效：admin 总数(${aList.data.total}) >= sales01 总数(${sList.data.total})`);

    const cDel = await ctx.req('DELETE', '/customer/' + cid, { token: at });
    t.ok(cDel.status === 200, `删除测试客户（清理）（${cDel.status}）`);
  }

  // ---------- G. Excel 模板下载 ----------
  const tpl = await ctx.req('GET', '/sys/users/template', { token: at });
  const ct = tpl.headers && tpl.headers.get ? tpl.headers.get('content-type') : '';
  t.ok(tpl.status === 200 && (ct.includes('spreadsheetml') || (tpl.text || '').length > 0), `admin 下载用户导入模板（${tpl.status}, ${ct || 'bin'}）`);
  const sTpl = await ctx.req('GET', '/sys/users/template', { token: st });
  t.ok(sTpl.status === 403, `sales01 下载模板被拦截（${sTpl.status}=403）`);

  // ---------- H. 部门树 / 菜单全量 ----------
  const depts = await ctx.req('GET', '/sys/depts-tree', { token: at });
  t.ok(depts.status === 200 && Array.isArray(depts.data), `admin 读取部门树（${depts.status}）`);
  const menusAll = await ctx.req('GET', '/sys/menus-all', { token: at });
  t.ok(menusAll.status === 200 && Array.isArray(menusAll.data) && menusAll.data.length > 0, `admin 读取全部菜单（${menusAll.data.length} 条）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
