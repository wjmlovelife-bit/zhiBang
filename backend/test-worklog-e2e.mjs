// 端到端测试：sales01 操作 + admin 查 worklog list
const BASE = 'http://127.0.0.1:3001/api';

async function login(username, password) {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await r.json()).token;
}

async function api(path, method, body, token) {
  const opts = { method, headers: {} };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, opts);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

function sep(label) { console.log('\n' + '='.repeat(60) + '\n' + label + '\n' + '='.repeat(60)); }

async function main() {
  // 0. 基线检查
  sep('0. 基线：当前 sales01 负责的客户+项目 updatedAt 状态');
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  const beforeCust = await p.crmCustomer.findMany({
    where: { ownerId: 2, updatedAt: { gte: new Date('2026-09-03T00:00:00.000Z') } },
    select: { id: true, name: true, code: true, updatedAt: true },
  });
  const beforeProj = await p.crmOpportunity.findMany({
    where: { ownerId: 2, updatedAt: { gte: new Date('2026-09-03T00:00:00.000Z') } },
    select: { id: true, name: true, code: true, updatedAt: true },
  });
  console.log('今天已更新的客户（sales01 负责）:', beforeCust.length, '条');
  beforeCust.forEach(c => console.log('  ', c.id, c.code, c.name, c.updatedAt));
  console.log('今天已更新的项目（sales01 负责）:', beforeProj.length, '条');
  beforeProj.forEach(pr => console.log('  ', pr.id, pr.code, pr.name, pr.updatedAt));
  await p.$disconnect();

  // 1. sales01 登录
  sep('1. sales01 登录');
  const sales01Token = await login('sales01', '123456');
  console.log('sales01 token:', sales01Token?.slice(0, 30) + '...');

  // 2. 新建客户
  sep('2. sales01 新建客户');
  const newCustR = await api('/customer', 'POST', {
    name: '测试_客户_20260903_sales01',
    type: '单位客户',
    category: '终端公司',
    followStage: '初期沟通',
    source: '独立开发',
    industry: '国防军工',
    valueRating: '高',
    creditLevel: 'AAA',
    currencyCode: '人民币',
    region: ['北京市', '市辖区'],
    stateId: 1,
    cityId: 2,
    address: '北京市朝阳区测试地址 1 号',
    zipcode: '100000',
    remark: 'AI 测试新建客户 by sales01',
    submitStatus: 'active',
  }, sales01Token);
  console.log('状态:', newCustR.status);
  console.log('新客户:', JSON.stringify({ id: newCustR.data.id, code: newCustR.data.code, name: newCustR.data.name, ownerId: newCustR.data.ownerId }));
  const newCustId = newCustR.data.id;

  // 3. 新建项目（关联新客户）
  sep('3. sales01 新建项目（关联新建客户）');
  const newProjR = await api('/project', 'POST', {
    name: '测试_项目_20260903_sales01',
    customerCode: newCustR.data.code,
    customerId: newCustId,
    dateOpen: '2026-09-03',
    category: '系统集成',
    stage: '初期沟通',
    source: '独立开发',
    state: '跟踪',
    currencyCode: '人民币',
    expectedRevenue: '100000',
    amountFinal: '100000',
    plannedCost: '50000',
    description: 'AI 测试新建项目 by sales01',
    submitStatus: 'active',
  }, sales01Token);
  console.log('状态:', newProjR.status);
  console.log('新项目:', JSON.stringify({ id: newProjR.data.id, code: newProjR.data.code, name: newProjR.data.name, ownerId: newProjR.data.ownerId }));
  const newProjId = newProjR.data.id;

  // 4. 修改客户 674
  sep('4. sales01 修改客户 674（改 remark）');
  const d674R = await api('/customer/674', 'PUT', {
    name: '区域测试客户',
    remark: '【测试标记 ' + new Date().toISOString() + '】sales01 修改的备注',
  }, sales01Token);
  console.log('状态:', d674R.status, 'updatedAt:', d674R.data.updatedAt);

  // 5. 修改项目 39
  sep('5. sales01 修改项目 39（改 description）');
  const p39R = await api('/project/39', 'PUT', {
    name: '全字段测试项目-智能仪表采购',
    description: '【测试标记 ' + new Date().toISOString() + '】sales01 修改的描述',
  }, sales01Token);
  console.log('状态:', p39R.status, 'updatedAt:', p39R.data.updatedAt);

  // 6. admin 登录
  sep('6. admin 登录');
  const adminToken = await login('admin', '123456');
  console.log('admin token:', adminToken?.slice(0, 30) + '...');

  // 7. admin 查 worklog list（按截图筛选：人员=张三(sales01 id=2) + 日期=2026-09-03~2026-09-03）
  sep('7. admin 查 worklog list（按截图筛选）');
  const wlR = await api('/worklog?page=1&pageSize=20&ownerId=2&dateStart=2026-09-03&dateEnd=2026-09-03', 'GET', null, adminToken);
  console.log('状态:', wlR.status);
  if (wlR.status === 200) {
    const d = wlR.data;
    console.log('changeRange:', d.changeRange);
    console.log('changedCustomers.total:', d.changedCustomers?.total);
    console.log('changedCustomers.items.length:', d.changedCustomers?.items?.length);
    console.log('changedCustomers.items:');
    (d.changedCustomers?.items || []).forEach(c => {
      console.log('  ', c.id, c.code, '|', c.name, '| 负责人:', c.owner?.name, '|', c.updatedAt);
    });
    console.log('\nchangedProjects.total:', d.changedProjects?.total);
    console.log('changedProjects.items.length:', d.changedProjects?.items?.length);
    console.log('changedProjects.items:');
    (d.changedProjects?.items || []).forEach(pr => {
      console.log('  ', pr.id, pr.code, '|', pr.name, '| 负责人:', pr.owner?.name, '| 客户:', pr.customer?.name, '|', pr.updatedAt);
    });
  } else {
    console.log('错误:', JSON.stringify(wlR.data).slice(0, 500));
  }

  // 8. 验证
  sep('8. 验证结论');
  if (wlR.status === 200) {
    const custs = wlR.data.changedCustomers?.items || [];
    const projs = wlR.data.changedProjects?.items || [];

    const newCustFound = custs.find(c => c.id === newCustId);
    const d674Found = custs.find(c => c.id === 674);
    const newProjFound = projs.find(p => p.id === newProjId);
    const p39Found = projs.find(p => p.id === 39);

    console.log('【新建客户】', newCustId, '在变更表中:', newCustFound ? '✅ 出现' : '❌ 缺失');
    if (newCustFound) {
      console.log('  客户编号:', newCustFound.code);
      console.log('  客户名称:', newCustFound.name);
      console.log('  负责销售人:', newCustFound.owner?.name);
    }
    console.log('【修改客户 674】在变更表中:', d674Found ? '✅ 出现' : '❌ 缺失');
    if (d674Found) {
      console.log('  客户编号:', d674Found.code);
      console.log('  客户名称:', d674Found.name);
      console.log('  负责销售人:', d674Found.owner?.name);
    }
    console.log('【新建项目】', newProjId, '在变更表中:', newProjFound ? '✅ 出现' : '❌ 缺失');
    if (newProjFound) {
      console.log('  项目编号:', newProjFound.code);
      console.log('  项目名称:', newProjFound.name);
      console.log('  负责销售人:', newProjFound.owner?.name);
      console.log('  客户名称:', newProjFound.customer?.name);
    }
    console.log('【修改项目 39】在变更表中:', p39Found ? '✅ 出现' : '❌ 缺失');
    if (p39Found) {
      console.log('  项目编号:', p39Found.code);
      console.log('  项目名称:', p39Found.name);
      console.log('  负责销售人:', p39Found.owner?.name);
    }

    const allOk = newCustFound && d674Found && newProjFound && p39Found;
    console.log('\n=== 总体结论:', allOk ? '✅ 全部 4 条都正确显示' : '❌ 有缺失');
  }
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => process.exit(0));
