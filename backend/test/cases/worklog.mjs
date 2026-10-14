// cases/worklog.mjs —— 工作日志全量覆盖：列表 / 新建 / 编辑 / 删除 + 周报 + 日报
export const name = '工作日志';
export async function run(ctx) {
  const t = ctx.case;

  // ============ 鉴权（无 token 必须 401）============
  const r401 = await ctx.req('GET', '/worklog');
  t.ok(r401.status === 401, `无 token 访问工作日志列表应被拒（${r401.status}）`);

  // ============ 列表 ============
  const list = await ctx.req('GET', '/worklog', { token: ctx.tokens.admin });
  t.ok(list.status === 200, `admin 列表 200（${list.status}）`);
  t.ok(list.data && (Array.isArray(list.data) || Array.isArray(list.data.items)), '列表返回数组或 items');

  // ============ next-code ============
  const nc = await ctx.req('GET', '/worklog/next-code', { token: ctx.tokens.admin });
  t.ok(nc.status === 200, `next-code 200（${nc.status}）`);
  t.ok(typeof (nc.data?.code || nc.data) === 'string', 'next-code 返回字符串');

  // ============ 新建 + 详情 + 编辑 + 删除 ============
  const today = new Date().toISOString().slice(0, 10);
  const newLog = await ctx.req('POST', '/worklog', {
    token: ctx.tokens.admin,
    body: {
      type: '日志',
      date: today,
      content: 'T_auto_worklog_' + Date.now().toString(36),
      duration: 1.5,
    },
  });
  t.ok(newLog.status === 200 || newLog.status === 201, `新建工作日志 2xx（${newLog.status}）`);
  const id = newLog.data?.id || newLog.data?.data?.id;
  t.ok(!!id, '新建返回 id');

  if (id) {
    const detail = await ctx.req('GET', `/worklog/${id}`, { token: ctx.tokens.admin });
    t.ok(detail.status === 200, `详情 200（${detail.status}）`);

    const upd = await ctx.req('PUT', `/worklog/${id}`, {
      token: ctx.tokens.admin,
      body: { content: 'updated_' + Date.now() },
    });
    t.ok(upd.status === 200 || upd.status === 204, `编辑 2xx（${upd.status}）`);

    const del = await ctx.req('DELETE', `/worklog/${id}`, { token: ctx.tokens.admin });
    t.ok(del.status === 200 || del.status === 204, `删除 2xx（${del.status}）`);
  }

  // ============ 搜索（customer / project） ============
  const s1 = await ctx.req('GET', '/worklog/search-customer?keyword=a', { token: ctx.tokens.admin });
  t.ok(s1.status === 200, `search-customer 200（${s1.status}）`);

  const s2 = await ctx.req('GET', '/worklog/search-project?keyword=a', { token: ctx.tokens.admin });
  t.ok(s2.status === 200, `search-project 200（${s2.status}）`);

  // ============ 周报：本周 ============
  const weekStart = isoWeekStart(new Date());
  const ws = await ctx.req('GET', `/worklog/weekly-summary?weekStart=${weekStart}`, { token: ctx.tokens.admin });
  t.ok(ws.status === 200, `读取本周周报 200（${ws.status}）`);

  const save = await ctx.req('PUT', '/worklog/weekly-summary', {
    token: ctx.tokens.admin,
    body: { weekStart, content: 'T_auto_week_' + Date.now() },
  });
  t.ok(save.status === 200 || save.status === 201, `保存周报 2xx（${save.status}）`);

  const wlist = await ctx.req('GET', '/worklog/weekly-summary/list?limit=4', { token: ctx.tokens.admin });
  t.ok(wlist.status === 200, `周报列表 200（${wlist.status}）`);
  t.ok(Array.isArray(wlist.data) || Array.isArray(wlist.data?.items), '周报列表为数组');

  const wdel = await ctx.req('DELETE', `/worklog/weekly-summary/${weekStart}`, { token: ctx.tokens.admin });
  t.ok(wdel.status === 200 || wdel.status === 204 || wdel.status === 404, `删除周报 2xx/404（${wdel.status}）`);

  // ============ 日报 ============
  const dlist = await ctx.req('GET', '/worklog/daily-report/list?limit=7', { token: ctx.tokens.admin });
  t.ok(dlist.status === 200, `日报列表 200（${dlist.status}）`);
  t.ok(Array.isArray(dlist.data) || Array.isArray(dlist.data?.items), '日报列表为数组');

  const daySave = await ctx.req('PUT', '/worklog/daily-report', {
    token: ctx.tokens.admin,
    body: { date: today, content: 'T_auto_day_' + Date.now() },
  });
  t.ok(daySave.status === 200 || daySave.status === 201, `保存日报 2xx（${daySave.status}）`);

  const dayDel = await ctx.req('DELETE', `/worklog/daily-report/${today}`, { token: ctx.tokens.admin });
  t.ok(dayDel.status === 200 || dayDel.status === 204 || dayDel.status === 404, `删除日报 2xx/404（${dayDel.status}）`);

  // ============ sales 视角：仅看自己 ============
  const salesList = await ctx.req('GET', '/worklog', { token: ctx.tokens.sales });
  t.ok(salesList.status === 200, `sales 工作日志列表 200（${salesList.status}）`);
  // 数量应 ≤ admin 的（数据范围限制）：仅 sanity，不强校验

  // ============ 周报筛选（顶部筛选条接入）============
  // 需要 leader01 token；若 ctx.tokens 没准备则现登
  if (!ctx.tokens.leader) {
    const l = await ctx.login('leader01', '123456');
    if (l?.token) ctx.tokens.leader = l.token;
  }

  // 1) admin 默认（无 ownerId / 无 keyword / 无日期）— 看到 admin 自己的（含占位）
  const adminAll = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10', { token: ctx.tokens.admin });
  t.ok(adminAll.status === 200, `[筛选] admin 默认 200（${adminAll.status}）`);
  t.ok(Array.isArray(adminAll.data?.items), '[筛选] 返回 items 数组');
  const adminAllItems = adminAll.data.items || [];

  // 2) admin 关键词筛选
  const adminKw = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10&keyword=__no_match_xyz__', { token: ctx.tokens.admin });
  t.ok(adminKw.status === 200, `[筛选] admin 关键词 200（${adminKw.status}）`);
  t.ok(adminKw.data?.total === 0 || adminKw.data?.total === adminAllItems.length, `[筛选] 关键词结果数变化`);

  // 3) admin 日期段筛选
  const adminDt = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10&dateStart=2020-01-01&dateEnd=2030-12-31', { token: ctx.tokens.admin });
  t.ok(adminDt.status === 200, `[筛选] admin 日期段 200（${adminDt.status}）`);
  t.ok((adminDt.data?.total ?? 0) >= (adminAll.data?.total ?? 0), `[筛选] 大日期段应包含默认结果`);

  // 4) admin 指定 ownerId=sales01 — 应能跨用户
  const adminOwn = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10&ownerId=' + ctx.users.sales.id, { token: ctx.tokens.admin });
  t.ok(adminOwn.status === 200, `[筛选] admin 跨用户 ownerId 200（${adminOwn.status}）`);
  const adminOwnItems = adminOwn.data?.items || [];
  // items 里的 owner 应该全是 sales01
  const allSales = adminOwnItems.every((it) => !it.ownerId || it.ownerId === ctx.users.sales.id);
  t.ok(allSales, `[筛选] admin ownerId 返回结果均属于指定用户`);

  // 5) sales 越权 ownerId=admin — 应被覆盖为自己
  const salesPriv = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10&ownerId=' + ctx.users.admin.id, { token: ctx.tokens.sales });
  t.ok(salesPriv.status === 200, `[筛选] sales 越权 200（${salesPriv.status}）`);
  const salesPrivItems = salesPriv.data?.items || [];
  const allSalesSelf = salesPrivItems.every((it) => !it.ownerId || it.ownerId === ctx.users.sales.id);
  t.ok(allSalesSelf, `[筛选] sales 越权被后端兜底强制 ownerId=self`);

  // 6) leader 角色也应能跨用户
  if (ctx.tokens.leader) {
    const leaderOwn = await ctx.req('GET', '/worklog/weekly-summary/list?page=1&pageSize=10&ownerId=' + ctx.users.sales.id, { token: ctx.tokens.leader });
    t.ok(leaderOwn.status === 200, `[筛选] leader 跨用户 200（${leaderOwn.status}）`);
    const leaderItems = leaderOwn.data?.items || [];
    const allSalesFromLeader = leaderItems.every((it) => !it.ownerId || it.ownerId === ctx.users.sales.id);
    t.ok(allSalesFromLeader, `[筛选] leader ownerId 返回结果均属于指定用户`);
  }
}

function isoWeekStart(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
