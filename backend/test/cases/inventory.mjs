// 库存模块：列表（带/不带 filter）/ 详情 / 创建 / 更新 / 删除 / 数据范围（admin/leader 看全 vs sales 仅本人）/ 模块白名单 / 导出
export const name = '库存模块';
export async function run(ctx) {
  const t = ctx.case;
  const at = ctx.tokens.admin;
  const lt = ctx.tokens.leader || ctx.tokens.admin; // leader 不一定有 token，回退用 admin
  const st = ctx.tokens.sales;
  const ts = Date.now();

  // ---------- A. admin：列表 + 过滤 ----------
  const list0 = await ctx.req('GET', '/inventory/list?page=1&pageSize=10', { token: at });
  t.ok(list0.status === 200 && list0.data && typeof list0.data.total === 'number', `admin 库存列表（total=${list0.data && list0.data.total}）`);
  t.ok(Array.isArray(list0.data.items), `库存列表 items 为数组（length=${(list0.data.items || []).length}）`);

  // 过滤：productName（含）
  const list1 = await ctx.req('GET', '/inventory/list?productName=' + encodeURIComponent('测试'), { token: at });
  t.ok(list1.status === 200, `库存按商品名称过滤（${list1.status}）`);
  // 过滤：productModel
  const list2 = await ctx.req('GET', '/inventory/list?productModel=' + encodeURIComponent('DS'), { token: at });
  t.ok(list2.status === 200, `库存按商品型号过滤（${list2.status}）`);
  // 过滤：manufacturer
  const list3 = await ctx.req('GET', '/inventory/list?manufacturer=' + encodeURIComponent('RIGOL'), { token: at });
  t.ok(list3.status === 200, `库存按厂家过滤（${list3.status}）`);

  // ---------- B. admin：创建（必填）----------
  const missing = await ctx.req('POST', '/inventory', { token: at, body: { remark: '缺必填' } });
  t.ok(missing.status >= 400, `缺必填字段被拒绝（${missing.status}）`);

  const cname = '示波器_' + ts;
  const create = await ctx.req('POST', '/inventory', {
    token: at,
    body: {
      productName: cname,
      productModel: 'DS7054_' + ts,
      manufacturer: 'RIGOL',
      date: '2026-08-28',
      remark: '库存备注测试'.repeat(20),
      attachments: [{ url: '/api/upload/inv.txt', name: 'inv.txt' }],
    },
  });
  t.ok(create.status === 201 || create.status === 200, `admin 创建库存（${create.status}）`);
  const id = create.data && create.data.id;
  t.ok(!!id, `返回库存 id=${id}`);

  if (id) {
    // 详情
    const det = await ctx.req('GET', '/inventory/' + id, { token: at });
    t.ok(det.status === 200 && det.data.productName === cname, `admin 库存详情（productName=${det.data && det.data.productName}）`);
    t.ok(det.data.productModel && det.data.productModel.endsWith(String(ts)), 'productModel 已存（含时间戳）');
    t.ok((det.data.remark || '').length > 100, `备注大文本已存（长度 ${(det.data.remark || '').length}）`);

    // 更新
    const upd = await ctx.req('PUT', '/inventory/' + id, { token: at, body: { remark: '更新后备注', manufacturer: 'RIGOL/普源' } });
    t.ok(upd.status === 200, `admin 更新库存（${upd.status}）`);
    if (upd.status === 200) {
      const det2 = await ctx.req('GET', '/inventory/' + id, { token: at });
      t.ok(det2.data.manufacturer === 'RIGOL/普源', '更新后 manufacturer 已生效');
      t.ok(det2.data.remark === '更新后备注', '更新后 remark 已生效');
    }
  }

  // ---------- C. admin：导出 ----------
  const exp = await ctx.req('GET', '/inventory/export', { token: at });
  t.ok(exp.status === 200 && Array.isArray(exp.data), `admin 库存导出（length=${(exp.data || []).length}）`);

  // ---------- D. 数据范围：admin 看全 vs sales 仅本人 ----------
  if (id && st) {
    const aList = await ctx.req('GET', '/inventory/list?pageSize=1000', { token: at });
    const sList = await ctx.req('GET', '/inventory/list?pageSize=1000', { token: st });
    t.ok(sList.status === 200, `sales01 列表请求成功（${sList.status}）`);
    t.ok(sList.data.total <= aList.data.total, `sales01 数据范围 ≤ admin（admin=${aList.data.total}, sales=${sList.data.total}）`);
    // sales01 看不到别人创建的数据（这次 admin 创建的，不应出现在 sales 列表里）
    const seen = (sList.data.items || []).some((r) => r.id === id);
    t.ok(!seen, 'sales01 列表里**不含**admin 创建的库存（数据范围过滤生效）');

    // sales01 不能直接按 id 拿他人详情
    const sDet = await ctx.req('GET', '/inventory/' + id, { token: st });
    t.ok(sDet.status === 404, `sales01 直接访问他人库存 detail=404（${sDet.status}）`);
  }

  // ---------- E. 模块白名单：leader 可见（如果 leader 有 token）----------
  if (ctx.tokens.leader) {
    const lr = await ctx.login('leader01', '123456');
    t.ok(lr.status === 200 || lr.status === 201, 'leader01 可登录');
    const lList = await ctx.req('GET', '/inventory/list?pageSize=1000', { token: lr.token });
    t.ok(lList.status === 200, 'leader 库存列表通过');
    if (id) {
      const lDet = await ctx.req('GET', '/inventory/' + id, { token: lr.token });
      t.ok(lDet.status === 200, 'leader 可见所有库存（模块白名单）');
    }
  }

  // ---------- F. 清理 ----------
  if (id) {
    const rm = await ctx.req('DELETE', '/inventory/' + id, { token: at });
    t.ok(rm.status === 200, `admin 删除库存（清理）（${rm.status}）`);
  }
}
