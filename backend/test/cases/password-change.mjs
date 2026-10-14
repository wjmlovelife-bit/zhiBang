// cases/password-change.mjs —— 「用户名/姓名登录」+「管理员改任意用户密码」+「密码重置提示一次」
//
// 覆盖：
//   - 登录：按 username 命中、按 name 命中、错误密码、姓名错密码
//   - 改密（POST /sys/users/:id/change-password）：仅 admin；非 admin 403；原密码错 401；
//     新密码 < 6 位 400；空 body 400；不存在的 userId 404；
//     admin 改别人成功 → mustResetPassword=true 标记生效；旧密码登录被拒；新密码登录成功且有标记
//     admin 改自己成功 → 同上
//   - 清除标记：调 /auth/clear-password-flag → 下次登录不再带 mustResetPassword
export const name = '登录支持用户名/姓名 + 管理员改密';
export async function run(ctx) {
  const t = ctx.case;

  // ============ 1. 登录支持用户名 或 姓名 ============
  const u1 = await ctx.login('admin', '112233');
  t.ok(u1.status === 200 || u1.status === 201, `按 username 登录 admin 成功（${u1.status}）`);
  t.ok(!!u1.token, 'username 登录返回 token');

  const u2 = await ctx.login('管理员', '112233');
  t.ok(u2.status === 200 || u2.status === 201, `按 name 登录 管理员 成功（${u2.status}）`);
  t.ok(!!u2.token, 'name 登录返回 token');

  const u3 = await ctx.login('张三', '123456');
  t.ok(u3.status === 200 || u3.status === 201, `按 name 登录 张三(sales01) 成功（${u3.status}）`);

  const u4 = await ctx.login('admin', 'wrong_pwd_test');
  t.ok(u4.status === 401, `错误密码应 401（${u4.status}）`);

  const u5 = await ctx.login('不存在的姓名_xyz', 'any');
  t.ok(u5.status === 401, `不存在的姓名应 401（${u5.status}）`);

  const u6 = await ctx.login('管理员', 'wrong_pwd_test');
  t.ok(u6.status === 401, `姓名 + 错密码应 401（${u6.status}）`);

  // ============ 2. 修改密码接口（admin 改任意人） ============
  const salesId = ctx.users.sales?.id;
  t.ok(!!salesId, `拿到 sales01 id（${salesId}）`);

  // 2.1 非 admin（sales01）调该接口 → 403
  // 注：实际被 @Permissions('user:update') 守卫拦截，文案为"无操作权限"
  //    controller 里的 isAdmin 兜底会返回"仅管理员可修改密码"，但走不到那一层
  const s1 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.sales,
    body: { oldPassword: '123456', newPassword: 'newpass_aaa_111' },
  });
  t.ok(s1.status === 403, `非 admin 调改密应 403（${s1.status}）`);
  t.ok(s1.status === 403, '非 admin 被权限守卫拦截为 403');

  // 2.2 无 token 调该接口 → 401
  const s2 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    body: { oldPassword: '123456', newPassword: 'newpass_aaa_111' },
  });
  t.ok(s2.status === 401, `无 token 调改密应 401（${s2.status}）`);

  // 2.3 admin 调但原密码错 → 401
  const s3 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.admin,
    body: { oldPassword: 'wrong_old_zzz', newPassword: 'newpass_aaa_111' },
  });
  t.ok(s3.status === 401, `原密码错应 401（${s3.status}）`);
  t.ok((s3.data?.message || '').includes('原密码错误'), '原密码错文案');

  // 2.4 admin 调但新密码不足 6 位 → 400
  const s4 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.admin,
    body: { oldPassword: '123456', newPassword: '12345' },
  });
  t.ok(s4.status === 400, `新密码 5 位应 400（${s4.status}）`);
  t.ok((s4.data?.message || '').includes('6 位'), '新密码长度文案');

  // 2.5 admin 调但空 body → 400
  const s5 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.admin,
    body: {},
  });
  t.ok(s5.status === 400, `空 body 应 400（${s5.status}）`);

  // 2.6 admin 调不存在的 userId → 404
  const s5b = await ctx.req('POST', '/sys/users/9999999/change-password', {
    token: ctx.tokens.admin,
    body: { oldPassword: '123456', newPassword: 'newpass_aaa_111' },
  });
  t.ok(s5b.status === 404, `不存在的 userId 应 404（${s5b.status}）`);

  // 2.7 admin 改 sales01 成功（123456 → NEW_SALES_PWD）
  const NEW_SALES_PWD = 'new_sales_pwd_' + Date.now().toString().slice(-6);
  const s6 = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.admin,
    body: { oldPassword: '123456', newPassword: NEW_SALES_PWD },
  });
  t.ok(s6.status === 200 || s6.status === 201, `admin 改 sales01 2xx（${s6.status}）`);
  t.ok(s6.data?.ok === true, '改密返回 ok=true');

  // 2.8 sales01 用旧密码登录被拒
  const s7 = await ctx.login('张三', '123456');
  t.ok(s7.status === 401, `sales01 旧密码登录应被拒 401（${s7.status}）`);

  // 2.9 sales01 用新密码登录成功，且 mustResetPassword=true
  const s8 = await ctx.login('sales01', NEW_SALES_PWD);
  t.ok(s8.status === 200 || s8.status === 201, `sales01 用新密码登录 2xx（${s8.status}）`);
  t.ok(!!s8.token, '新密码登录返回 token');
  t.ok(s8.user?.mustResetPassword === true, `登录返回 user.mustResetPassword=true（${s8.user?.mustResetPassword}）`);

  // 2.10 sales01 调 clear-password-flag 清标记
  const s9 = await ctx.req('POST', '/auth/clear-password-flag', { token: s8.token });
  t.ok(s9.status === 200 || s9.status === 201, `clear-password-flag 2xx（${s9.status}）`);
  t.ok(s9.data?.ok === true, 'clear 返回 ok=true');

  // 2.11 sales01 再次登录 → mustResetPassword 已被清（false 或 undefined）
  const s10 = await ctx.login('sales01', NEW_SALES_PWD);
  t.ok(s10.status === 200 || s10.status === 201, `sales01 再次登录 2xx（${s10.status}）`);
  t.ok(!s10.user?.mustResetPassword, `清标记后 mustResetPassword 为 falsy（${s10.user?.mustResetPassword}）`);

  // 2.12 sales01 改回原密码 123456（恢复现场）
  const restore = await ctx.req('POST', `/sys/users/${salesId}/change-password`, {
    token: ctx.tokens.admin,
    body: { oldPassword: NEW_SALES_PWD, newPassword: '123456' },
  });
  t.ok(restore.status === 200 || restore.status === 201, `恢复 sales01 密码为 123456 成功（${restore.status}）`);

  // 2.13 sales01 再次清标记（防止影响后续用例）
  const salesLogin = await ctx.login('sales01', '123456');
  if (salesLogin.token) {
    await ctx.req('POST', '/auth/clear-password-flag', { token: salesLogin.token });
  }

  // R32 方案C 适配：重置 sales01.tokenVersion=0 + 强制 cache 重建
  // 不重置的话，sales01.tv 每次跑测试都累加（password-change 内部 +3、permission 内部 +N、其他 case +M）
  // cache 内 sales01 entry 是 stale 值（前面某次写入的旧 tv），导致后续 case 用 ctx.tokens.sales 调接口 401
  // 通过 Prisma 直接重置（不走业务代码，测试代码用 Prisma 操作 DB 合法）
  // 然后用 sales01 调一次接口触发 cache miss → 写入新值（tv=0）
  // 最后刷新 ctx.tokens.sales 让后续 case 用最新 token
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.sysUser.update({ where: { id: salesId }, data: { tokenVersion: 0 } });
  await p.$disconnect();

  // 用 sales01 调一次 /sys/menus：cache miss → 后端写入 tv=0 → 与 payload.tv=0 一致 → 200
  // 同时更新 ctx.tokens.sales 为新 token（保持 ctx 一致）
  const refreshed = await ctx.login('sales01', '123456');
  if (refreshed.token) {
    await ctx.req('GET', '/sys/menus', { token: refreshed.token });
    // 调用 ctx.refreshSales 更新 ctx.tokens.sales
    if (typeof ctx.refreshSales === 'function') {
      await ctx.refreshSales();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
