// 客户模块：编号生成 / 创建 / 详情(区域·联系人办公电话·传真·备注·财务) / 跟进 / 继承 / 列表过滤 / 搜索 / 上传附件
export const name = '客户模块';
export async function run(ctx) {
  const t = ctx.case;
  const token = ctx.tokens.admin;
  const region = ctx.regionIds || { stateId: null, cityId: null, districtId: null, region: [] };
  const fsMod = await import('fs');
  const os = await import('os');
  const pathMod = await import('path');

  // 编号自动生成
  const nc = await ctx.req('GET', '/customer/next-code', { token });
  t.ok(typeof nc.data === 'string' && nc.data.startsWith('KH'), `客户编号自动生成（${nc.data}）`);
  const code = nc.data;

  // 创建（含区域 id、联系人办公电话/传真、备注大文本、附件占位）
  const cname = '测试客户_' + Date.now();
  const create = await ctx.req('POST', '/customer', {
    token,
    body: {
      code,
      name: cname,
      category: '终端公司',
      followStage: '高',
      industry: '电子',
      currencyCode: '人民币',
      stateId: region.stateId,
      cityId: region.cityId,
      districtId: region.districtId,
      region: region.region,
      remark: '备注测试内容'.repeat(30),
      contacts: [
        { name: '张三', gender: '男', dept: '采购', title: '经理', mobile: '13800000000', wechat: 'zhang', officePhone: '010-12345678', fax: '010-87654321' },
      ],
      attachments: [{ url: '/api/upload/demo.txt', name: 'demo.txt' }],
    },
  });
  t.ok(create.status === 201 || create.status === 200, `创建客户成功（${create.status}）`);
  const cid = create.data && create.data.id;
  t.ok(!!cid, `返回客户 id = ${cid}`);
  t.ok(create.data && create.data.code === code, `返回编号与请求一致（${create.data && create.data.code}）`);

  if (cid) {
    // 详情校验修复点 #2/#3/#4
    const det = await ctx.req('GET', '/customer/' + cid, { token });
    const d = det.data || {};
    t.ok(d.stateId === region.stateId, `区域省 id 正确存储（${d.stateId}）`);
    t.ok(d.cityId === region.cityId, `区域市 id 正确存储（${d.cityId}）`);
    t.ok((d.remark || '').length > 100, `备注大文本已保存（长度 ${(d.remark || '').length}）`);
    const c0 = (d.contacts || [])[0] || {};
    t.ok(c0.officePhone === '010-12345678', `联系信息含办公电话（${c0.officePhone}）`); // #2
    t.ok(c0.fax === '010-87654321', `联系信息含传真（${c0.fax}）`); // #2

    // 更新财务信息（银行地址/电话/结算日期） #3
    const upd = await ctx.req('PUT', '/customer/' + cid, {
      token,
      body: { bankAddress: '北京市海淀区', bankPhone: '010-11112222', settleDay: 15 },
    });
    t.ok(upd.status === 200, `更新客户成功（${upd.status}）`);
    if (upd.status === 200) {
      const det2 = await ctx.req('GET', '/customer/' + cid, { token });
      t.ok(det2.data.bankAddress === '北京市海淀区', `财务-银行地址已保存（${det2.data.bankAddress}）`);
      t.ok(det2.data.bankPhone === '010-11112222', `财务-银行电话已保存（${det2.data.bankPhone}）`);
      t.ok(String(det2.data.settleDay) === '15', `财务-结算日期已保存（${det2.data.settleDay}）`);
    }

    // 跟进
    const af = await ctx.req('POST', '/customer/' + cid + '/follow', { token, body: { content: '电话沟通需求', followDate: '2026-08-27' } });
    t.ok(af.status === 201 || af.status === 200, `添加跟进记录（${af.status}）`);
    const fs = await ctx.req('GET', '/customer/' + cid + '/follows', { token });
    t.ok(Array.isArray(fs.data) && fs.data.length > 0, `查询跟进记录（${(fs.data || []).length} 条）`);

    // 继承给他人（sales01）
    const salesId = ctx.users.sales.id || 2;
    const inh = await ctx.req('POST', '/customer/' + cid + '/inherit', { token, body: { toUserId: salesId, reason: '测试继承' } });
    t.ok(inh.status === 200 || inh.status === 201, `客户继承给他人（${inh.status}）`);

    // 删除（清理）
    const rm = await ctx.req('DELETE', '/customer/' + cid, { token });
    t.ok(rm.status === 200, `删除客户（清理）（${rm.status}）`);
  }

  // 列表 + 分页
  const list = await ctx.req('GET', '/customer/list?page=1&pageSize=10', { token });
  t.ok(list.status === 200 && list.data && typeof list.data.total === 'number', `客户列表分页（total=${list.data && list.data.total}）`);
  const list2 = await ctx.req('GET', '/customer/list?keyword=' + encodeURIComponent('测试客户'), { token });
  t.ok(list2.status === 200, `按关键词过滤（${list2.status}）`);

  // 搜索
  const srch = await ctx.req('GET', '/customer/search?keyword=', { token });
  t.ok(srch.status === 200 && Array.isArray(srch.data), `客户搜索接口（${srch.status}）`);

  // 上传附件 + 取回
  const tmp = pathMod.join(os.tmpdir(), 'zhibang_cust_' + Date.now() + '.txt');
  fsMod.writeFileSync(tmp, 'customer attachment payload');
  const form = new FormData();
  form.append('file', new Blob([fsMod.readFileSync(tmp)], { type: 'text/plain' }), 'cust.txt');
  const up = await ctx.req('POST', '/upload', { token, body: form });
  fsMod.unlinkSync(tmp);
  t.ok(up.status === 201, `附件上传（${up.status}）`);
  const fname = up.data && up.data.filename;
  t.ok(!!fname, `上传返回文件名（${fname}）`);
  if (fname) {
    const g = await ctx.req('GET', '/upload/' + fname, { token });
    t.ok(g.status === 200 && (g.text || '').includes('customer attachment'), `取回附件内容正确（${g.status}）`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
