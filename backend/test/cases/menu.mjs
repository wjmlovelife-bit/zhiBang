// 菜单结构：客户 / 项目 / 合同 三大模块均在菜单中
// 注：按用户要求，工作日志模块本次不纳入测试范围
export const name = '菜单结构';
export async function run(ctx) {
  const t = ctx.case;
  const r = await ctx.req('GET', '/sys/menus', { token: ctx.tokens.admin });
  const flat = JSON.stringify(r.data);
  t.ok(flat.includes('客户'), '菜单含「客户」');
  t.ok(flat.includes('项目'), '菜单含「项目」');
  t.ok(flat.includes('合同'), '菜单含「合同」');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
