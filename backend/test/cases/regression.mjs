// 回归测试：覆盖已修复的关键缺陷
// 1) 客户继承历史应带负责人姓名（修复 #8.3）
// 2) 日志按时间范围聚合应返回带 type 字段的统一时间线（修复 #9）
// 运行：cd backend && node test/run-all.mjs （需本地 PG 已启动）
export const name = '回归测试';
export async function run(ctx) {
  const t = ctx.case;
  const token = ctx.tokens.admin;

  // 1) 客户创建 + 继承：详情继承历史应带姓名（修复 #8.3）
  const nc = await ctx.req('GET', '/customer/next-code', { token });
  t.ok(typeof nc.data === 'string' && nc.data.startsWith('KH'), `客户编号自动生成（${nc.data}）`);
  const code = nc.data;
  const cname = '回归_客户_' + Date.now();
  const create = await ctx.req('POST', '/customer', {
    token,
    body: { code, name: cname, category: '终端公司' },
  });
  t.ok(create.status === 201 || create.status === 200, `回归-创建客户（${create.status}）`);
  const cid = create.data && create.data.id;
  if (cid) {
    const salesId = ctx.users.sales.id || 2;
    const inh = await ctx.req('POST', '/customer/' + cid + '/inherit', {
      token,
      body: { toUserId: salesId, reason: '回归继承' },
    });
    t.ok(inh.status === 200 || inh.status === 201, `回归-继承客户（${inh.status}）`);
    const det = await ctx.req('GET', '/customer/' + cid, { token });
    const inh0 = (det.data && det.data.inherits && det.data.inherits[0]) || {};
    t.ok(!!(inh0.fromUser && inh0.fromUser.name), `回归-继承历史显示原负责人姓名（${inh0.fromUser && inh0.fromUser.name}）`);
    // 清理
    await ctx.req('DELETE', '/customer/' + cid, { token });
  }

  // 2) 日志时间聚合：带日期范围应返回带 type 字段的行（修复 #9）
  // ★ 路由纠正：WorkLogController 的列表端点用 @Get()（裸 /api/worklog），不是 /worklog/list
  const now = new Date();
  const d0 = new Date(now.getTime() - 86400000 * 30).toISOString().slice(0, 10);
  const d1 = now.toISOString().slice(0, 10);
  const wl = await ctx.req('GET', `/worklog?dateStart=${d0}&dateEnd=${d1}&page=1&pageSize=20`, { token });
  t.ok(wl.status === 200, `回归-日志时间聚合接口（${wl.status}）`);
  t.ok(wl.data && Array.isArray(wl.data.items), `回归-日志聚合返回 items 数组`);
  const items = (wl.data && wl.data.items) || [];
  const allTyped = items.length === 0 || items.every((r) => !!r.type);
  t.ok(allTyped, `回归-聚合每行均带 type 字段（${items.length} 行）`);
}
