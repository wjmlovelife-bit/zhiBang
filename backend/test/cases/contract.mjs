// 合同模块：编号生成 / 创建(明细子表+付款计划) / 详情 / 更新 / 列表过滤 / 删除
export const name = '合同模块';
export async function run(ctx) {
  const t = ctx.case;
  const token = ctx.tokens.admin;

  const nc = await ctx.req('GET', '/contract/next-code', { token });
  t.ok(typeof nc.data === 'string' && nc.data.length > 0, `合同编号自动生成（${nc.data}）`);
  const code = nc.data;

  const create = await ctx.req('POST', '/contract', {
    token,
    body: {
      code,
      title: '测试合同_' + Date.now(),
      customerName: '测试客户公司',
      customerId: null,
      signDate: '2026-08-27',
      currencyCode: '人民币',
      amountTotal: 10000,
      approvalState: 'draft',
      lines: [{ productName: '测试仪表', quantity: 1, unitPrice: 10000, discount: 0, taxRate: 13, amount: 11300 }],
      paymentPlans: [{ seq: 1, planDate: '2026-09-30', amount: 10000, remark: '首付款' }],
    },
  });
  t.ok(create.status === 201 || create.status === 200, `创建合同成功（${create.status}）`);
  const cid = create.data && create.data.id;
  t.ok(!!cid, `返回合同 id = ${cid}`);

  if (cid) {
    const det = await ctx.req('GET', '/contract/' + cid, { token });
    t.ok(det.status === 200 && det.data, `合同详情（${det.status}）`);
    t.ok((det.data.lines || []).length === 1, `合同明细子表已保存（${(det.data.lines || []).length} 条）`);
    t.ok((det.data.paymentPlans || []).length === 1, `付款计划已保存（${(det.data.paymentPlans || []).length} 条）`);

    const upd = await ctx.req('PUT', '/contract/' + cid, { token, body: { approvalState: 'submitted' } });
    t.ok(upd.status === 200, `更新合同（${upd.status}）`);

    const rm = await ctx.req('DELETE', '/contract/' + cid, { token });
    t.ok(rm.status === 200, `删除合同（清理）（${rm.status}）`);
  }

  const list = await ctx.req('GET', '/contract/list?page=1&pageSize=10', { token });
  t.ok(list.status === 200 && list.data && typeof list.data.total === 'number', `合同列表分页（total=${list.data && list.data.total}）`);
  const list2 = await ctx.req('GET', '/contract/list?keyword=' + encodeURIComponent('测试合同'), { token });
  t.ok(list2.status === 200, `合同关键词过滤（${list2.status}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
