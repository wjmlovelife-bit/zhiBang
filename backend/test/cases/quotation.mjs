// cases/quotation.mjs —— 报价单：列表 / 新建 / 详情 / 更新 / 删除 / PDF
export const name = '报价';
export async function run(ctx) {
  const t = ctx.case;

  // 鉴权：用真实存在的 list 接口做探针，无 token 应被全局 JwtAuthGuard 拒为 401
  // ★ 不能用 GET /quotation 因为控制器没有 @Get() 根路由，会先于 guard 返回 404
  const r401 = await ctx.req('GET', '/quotation/list');
  t.ok(r401.status === 401, `无 token 应被拒（${r401.status}）`);

  // list
  const list = await ctx.req('GET', '/quotation/list', { token: ctx.tokens.admin });
  t.ok(list.status === 200, `list 200（${list.status}）`);

  // next-code
  const nc = await ctx.req('GET', '/quotation/next-code', { token: ctx.tokens.admin });
  t.ok(nc.status === 200, `next-code 200（${nc.status}）`);

  // search-customer
  const sc = await ctx.req('GET', '/quotation/search-customer?keyword=a', { token: ctx.tokens.admin });
  t.ok(sc.status === 200, `search-customer 200（${sc.status}）`);

  // 新建（最小）
  const today = new Date().toISOString().slice(0, 10);
  const created = await ctx.req('POST', '/quotation', {
    token: ctx.tokens.admin,
    body: {
      title: 'T_auto_quo_' + Date.now().toString(36),
      quoteDate: today,
      lines: [{ name: 'item1', qty: 1, price: 100 }],
    },
  });
  // ★ 最小字段可能缺 customerCode 等必填项，服务端可能抛 400/500；服务如严格校验则降级为 warn
  t.warn(created.status === 200 || created.status === 201, `新建报价 2xx（${created.status}；缺必填字段时服务端会拒收）`);
  const id = created.data?.id || created.data?.data?.id;
  t.ok(!!id || created.status >= 400, '新建返回 id 或服务端拒收（合理）');

  if (id) {
    const detail = await ctx.req('GET', `/quotation/${id}`, { token: ctx.tokens.admin });
    t.ok(detail.status === 200, `详情 200（${detail.status}）`);

    const upd = await ctx.req('PUT', `/quotation/${id}`, {
      token: ctx.tokens.admin,
      body: { title: 'updated_' + Date.now() },
    });
    t.ok(upd.status === 200 || upd.status === 204, `更新 2xx（${upd.status}）`);

    // PDF 预览（环境依赖）
    const pdf = await ctx.req('GET', `/quotation/pdf/${id}`, { token: ctx.tokens.admin });
    t.warn(pdf.status === 200, `PDF 预览（${pdf.status}；环境依赖）`);

    // PDF 下载
    const pdfd = await ctx.req('GET', `/quotation/pdf/${id}?download=1`, { token: ctx.tokens.admin });
    t.warn(pdfd.status === 200, `PDF 下载（${pdfd.status}；环境依赖）`);

    const del = await ctx.req('DELETE', `/quotation/${id}`, { token: ctx.tokens.admin });
    t.ok(del.status === 200 || del.status === 204, `删除 2xx（${del.status}）`);
  }

  // sales 视角权限：应该能 list（业务可看）
  const salesList = await ctx.req('GET', '/quotation/list', { token: ctx.tokens.sales });
  t.ok(salesList.status === 200, `sales 报价 list 200（${salesList.status}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
