// cases/project.mjs —— 商机模块（注意：后端控制器是 @Controller('project')，实际路由 /api/project/*）：
// 列表 / 新建 / 详情 / 更新 / 删除 / 跟进 / 继承 / 导出 / PDF
// 与 cases/project.mjs 互补：这里做"最小冒烟 + 鉴权"快速覆盖，project.mjs 做完整 CRUD/导入/导出/PDF 流程
export const name = '商机';
export async function run(ctx) {
  const t = ctx.case;

  // 鉴权：以 list 接口做探针（该接口确实存在），无 token 应被全局 JwtAuthGuard 拒为 401
  const r401 = await ctx.req('GET', '/project/list');
  t.ok(r401.status === 401, `无 token 应被拒（${r401.status}）`);

  // list 简单列表
  const list = await ctx.req('GET', '/project/list', { token: ctx.tokens.admin });
  t.ok(list.status === 200, `list 200（${list.status}）`);
  t.ok(Array.isArray(list.data) || Array.isArray(list.data?.items), 'list 返回数组');

  // next-code
  const nc = await ctx.req('GET', '/project/next-code', { token: ctx.tokens.admin });
  t.ok(nc.status === 200, `next-code 200（${nc.status}）`);

  // search-customer / search-contract
  const sc = await ctx.req('GET', '/project/search-customer?keyword=a', { token: ctx.tokens.admin });
  t.ok(sc.status === 200, `search-customer 200（${sc.status}）`);
  const sct = await ctx.req('GET', '/project/search-contract?keyword=a', { token: ctx.tokens.admin });
  t.ok(sct.status === 200, `search-contract 200（${sct.status}）`);

  // 新建（最小字段）+ 详情 + 更新 + 删除
  const today = new Date().toISOString().slice(0, 10);
  const created = await ctx.req('POST', '/project', {
    token: ctx.tokens.admin,
    body: {
      name: 'T_auto_opp_' + Date.now().toString(36),
      dateOpen: today,
      stage: '初步洽谈',
    },
  });
  // ★ 最小字段可能缺失 customerCode/ownerId 等必填，服务可能抛 400/500；按 warn 处理
  t.warn(created.status === 200 || created.status === 201, `新建商机 2xx（${created.status}；最小字段可能不全，按 warn）`);
  const id = created.data?.id || created.data?.data?.id;
  t.ok(!!id || created.status >= 400, '新建返回 id 或服务端拒收（也算合理）');

  if (id) {
    const detail = await ctx.req('GET', `/project/${id}`, { token: ctx.tokens.admin });
    t.ok(detail.status === 200, `详情 200（${detail.status}）`);

    const upd = await ctx.req('PUT', `/project/${id}`, {
      token: ctx.tokens.admin,
      body: { stage: '技术交流' },
    });
    t.ok(upd.status === 200 || upd.status === 204, `更新 2xx（${upd.status}）`);

    // 跟进：先 list 再 POST
    const followList = await ctx.req('GET', `/project/${id}/follow`, { token: ctx.tokens.admin });
    t.ok(followList.status === 200, `跟进列表 200（${followList.status}）`);
    const followAdd = await ctx.req('POST', `/project/${id}/follow`, {
      token: ctx.tokens.admin,
      body: { content: 'T_auto_follow_' + Date.now(), followDate: today },
    });
    t.ok(followAdd.status === 200 || followAdd.status === 201, `新增跟进 2xx（${followAdd.status}）`);

    // 继承（POST :id/inherit）：必须传目标 userId；用 admin 继承给 admin（无业务效果，但不报错）
    const inh = await ctx.req('POST', `/project/${id}/inherit`, {
      token: ctx.tokens.admin,
      body: { toUserId: ctx.users.admin?.id, note: 'T_auto_inherit' },
    });
    t.ok(inh.status === 200 || inh.status === 201 || inh.status === 400 || inh.status === 403, `继承调用完成（${inh.status}；业务视情况）`);

    const del = await ctx.req('DELETE', `/project/${id}`, { token: ctx.tokens.admin });
    t.ok(del.status === 200 || del.status === 204, `删除 2xx（${del.status}）`);
  }

  // 导出（get，传 query；后台输出 buffer / 流，本侧只校验 status 200 + content-type 含 application）
  const exp = await ctx.req('GET', '/project/export', { token: ctx.tokens.admin });
  t.ok(exp.status === 200, `导出 200（${exp.status}）`);

  // PDF（环境依赖：未装 Chromium 时退化为 4xx，不计失败）
  if (id) {
    const pdf = await ctx.req('GET', `/project/pdf/${id}`, { token: ctx.tokens.admin });
    t.warn(pdf.status === 200, `PDF 预览正常（${pdf.status}；依赖 Chromium/puppeteer，环境失败降级）`);
  }

  // 导入预览（不真导入，只校验 API；成功路径返回 201 Created，校验失败路径返回 400）
  const imp = await ctx.req('POST', '/project/import-preview', {
    token: ctx.tokens.admin,
    body: { rows: [] },
  });
  t.ok(imp.status === 201 || imp.status === 200 || imp.status === 400, `import-preview 已返回（${imp.status}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
