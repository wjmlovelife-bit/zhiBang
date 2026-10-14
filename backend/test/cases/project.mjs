// 项目模块：编号生成 / 客户关联 / 商品子表 / 跟进 / 地区id(#1修复) / 继承 / 导出CSV / 生成PDF / 导入预览+确认 / 列表过滤
export const name = '项目模块';
export async function run(ctx) {
  const t = ctx.case;
  const token = ctx.tokens.admin;
  const region = ctx.regionIds || { stateId: null, cityId: null, districtId: null, region: [] };
  const adminId = ctx.users.admin.id || 1;
  const salesId = ctx.users.sales.id || 2;

  // 准备一个关联客户
  const custNc = await ctx.req('GET', '/customer/next-code', { token });
  const cust = await ctx.req('POST', '/customer', {
    token,
    body: { code: custNc.data, name: '项目关联客户_' + Date.now(), category: '集成商', followStage: '中', industry: '电子', currencyCode: '人民币' },
  });
  const custId = cust.data && cust.data.id;
  const cCode = cust.data && cust.data.code;

  // 编号自动生成
  const nc = await ctx.req('GET', '/project/next-code', { token });
  t.ok(typeof nc.data === 'string' && nc.data.startsWith('XM'), `项目编号自动生成（${nc.data}）`);
  const code = nc.data;

  // 客户搜索
  const sc = await ctx.req('GET', '/project/search-customer?keyword=', { token });
  t.ok(sc.status === 200 && Array.isArray(sc.data), `项目-客户搜索（${sc.status}）`);

  // 创建（商品子表 + 跟进 + 地区 id）
  const create = await ctx.req('POST', '/project', {
    token,
    body: {
      code,
      name: '测试项目_' + Date.now(),
      customerCode: cCode,
      customerId: custId,
      dateOpen: '2026-08-27',
      category: '系统集成',
      stage: '初期沟通',
      source: '电话咨询',
      state: '跟踪',
      ownerId: adminId,
      expectedRevenue: 100000,
      discountPct: 9,
      stateId: region.stateId,
      cityId: region.cityId,
      districtId: region.districtId,
      region: region.region,
      description: '项目概要测试',
      items: [{ productName: '示波器', productCode: 'OSC-001', model: 'DS7000', unitPrice: 50000, quantity: 2, amount: 100000 }],
      follows: [{ followDate: '2026-08-27', content: '首次跟进' }],
    },
  });
  t.ok(create.status === 201 || create.status === 200, `创建项目成功（${create.status}）`);
  const pid = create.data && create.data.id;
  t.ok(!!pid, `返回项目 id = ${pid}`);

  if (pid) {
    const det = await ctx.req('GET', '/project/' + pid, { token });
    const d = det.data || {};
    t.ok(d.stateId === region.stateId, `项目地区省 id 正确存储（#1 修复验证）（${d.stateId}）`);
    t.ok(d.code === code, `项目编号一致（${d.code}）`);
    t.ok((d.items || []).length === 1, `商品子表已保存（${(d.items || []).length} 条）`);
    t.ok((d.customerCode || '') === cCode, `客户编号关联正确（${d.customerCode}）`);
    t.ok((d.follows || []).length >= 1, `跟进记录已保存（${(d.follows || []).length} 条）`);
    t.ok(d.amountFinal !== null && d.amountFinal !== undefined && Number(d.amountFinal) === 90000, `优惠后总额自动计算（${d.amountFinal}）`);

    // 项目附件：创建/更新/详情往返（依赖 CrmOpportunity.attachments 列，迁移前会 500）
    const attPayload = [{ url: '/api/upload/proj-test.txt', name: '项目附件测试.txt', size: 1024, mimetype: 'text/plain' }];
    const updAtt = await ctx.req('PUT', '/project/' + pid, {
      token,
      body: { attachments: attPayload },
    });
    t.ok(updAtt.status === 200, `项目附件更新（${updAtt.status}）`);
    const d2 = await ctx.req('GET', '/project/' + pid, { token });
    const saved = d2.data && d2.data.attachments;
    t.ok(Array.isArray(saved) && saved.length === 1 && saved[0].name === '项目附件测试.txt', `项目附件详情回读（length=${saved && saved.length}, name=${saved && saved[0] && saved[0].name}）`);
    t.ok(saved && saved[0].mimetype === 'text/plain', `项目附件 mimetype 保留（${saved && saved[0] && saved[0].mimetype}）`);

    // 添加跟进
    const af = await ctx.req('POST', '/project/' + pid + '/follow', { token, body: { content: '二次跟进', followDate: '2026-08-28' } });
    t.ok(af.status === 200 || af.status === 201, `项目添加跟进（${af.status}）`);
    const fs = await ctx.req('GET', '/project/' + pid + '/follow', { token });
    t.ok(Array.isArray(fs.data) && fs.data.length >= 2, `项目查询跟进（${(fs.data || []).length} 条）`);

    // 继承
    const inh = await ctx.req('POST', '/project/' + pid + '/inherit', { token, body: { toUserId: salesId, reason: '测试' } });
    t.ok(inh.status === 200 || inh.status === 201, `项目继承（${inh.status}）`);

    // 导出 CSV
    const exp = await ctx.req('GET', '/project/export?ids=' + pid, { token });
    t.ok(exp.status === 200, `项目导出 CSV（${exp.status}）`);
    t.ok((exp.text || '').includes('项目编号'), 'CSV 含表头「项目编号」');

    // 生成 PDF（依赖 puppeteer/Chromium，环境不满足仅告警）
    const pdf = await ctx.req('GET', '/project/pdf/' + pid, { token });
    t.warn(pdf.status === 200 && /pdf/.test(pdf.headers.get('content-type') || ''), `项目生成 PDF（${pdf.status}${pdf.headers.get('content-type') ? ' / ' + pdf.headers.get('content-type') : ''}）`);

    // 导入预览 + 确认
    const impName = '导入项目_' + Date.now();
    const prev = await ctx.req('POST', '/project/import-preview', {
      token,
      body: {
        rows: [
          { name: impName, customerCode: cCode, dateOpen: '2026-08-27', category: '系统集成', stage: '初期沟通', source: '电话咨询', state: '跟踪', ownerId: adminId },
          { name: '缺字段', customerCode: '', dateOpen: '', category: '', stage: '', source: '', state: '' },
        ],
      },
    });
    t.ok((prev.status === 200 || prev.status === 201) && prev.data.validCount === 1 && prev.data.invalidCount === 1, `导入预览校验（valid=${prev.data && prev.data.validCount}, invalid=${prev.data && prev.data.invalidCount}）`);

    const conf = await ctx.req('POST', '/project/import-confirm', { token, body: { rows: prev.data.valid } });
    t.ok(conf.status === 200 || conf.status === 201, `导入确认创建（${conf.status}）`);
    // 清理导入产生的项目
    const cleanList = await ctx.req('GET', '/project/list?keyword=' + encodeURIComponent(impName), { token });
    for (const it of cleanList.data.items || []) {
      await ctx.req('DELETE', '/project/' + it.id, { token });
    }

    // 删除项目（清理）
    const rm = await ctx.req('DELETE', '/project/' + pid, { token });
    t.ok(rm.status === 200, `删除项目（清理）（${rm.status}）`);
  }

  // 列表 + 过滤
  const list = await ctx.req('GET', '/project/list?page=1&pageSize=10', { token });
  t.ok(list.status === 200 && list.data && typeof list.data.total === 'number', `项目列表分页（total=${list.data && list.data.total}）`);
  const list2 = await ctx.req('GET', '/project/list?keyword=' + encodeURIComponent('测试'), { token });
  t.ok(list2.status === 200, `项目关键词过滤（${list2.status}）`);

  // 清理关联客户
  if (custId) await ctx.req('DELETE', '/customer/' + custId, { token });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
