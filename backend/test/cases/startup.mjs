// 启动检查：后端存活、鉴权中间件生效
export const name = '启动检查';
export async function run(ctx) {
  const t = ctx.case;
  const noAuth = await ctx.req('GET', '/sys/menus');
  t.ok(noAuth.status === 401, `未携带 token 访问受保护接口返回 401（收到 ${noAuth.status}）`);

  const okAuth = await ctx.req('GET', '/sys/menus', { token: ctx.tokens.admin });
  t.ok(okAuth.status === 200, `携带 token 访问菜单接口返回 200（收到 ${okAuth.status}）`);
  t.ok(Array.isArray(okAuth.data) || !!okAuth.data, '菜单接口返回数据结构正常');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
