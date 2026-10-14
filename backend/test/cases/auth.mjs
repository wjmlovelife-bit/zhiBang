// 登录鉴权：admin / sales01 正常登录，错误凭据被拒
export const name = '登录鉴权';
export async function run(ctx) {
  const t = ctx.case;
  const a = await ctx.login('admin', '112233');
  t.ok(a.status === 200 || a.status === 201, `admin 登录成功（${a.status}）`);
  t.ok(!!a.token, 'admin 返回 token');
  t.ok(a.user && (a.user.username === 'admin' || a.user.id), 'admin 返回用户信息');

  const s = await ctx.login('sales01', '123456');
  t.ok(s.status === 200 || s.status === 201, `sales01 登录成功（${s.status}）`);
  t.ok(!!s.token, 'sales01 返回 token');

  const bad = await ctx.login('admin', 'wrong-pass');
  t.ok(bad.status === 401 || bad.status === 400, `错误密码被拒绝（${bad.status}）`);
  const none = await ctx.login('no-such-user', 'x');
  t.ok(none.status === 401 || none.status === 400 || none.status === 404, `不存在用户被拒绝（${none.status}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
