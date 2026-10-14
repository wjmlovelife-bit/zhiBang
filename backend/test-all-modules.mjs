// 测试所有模块的 create + update
const BASE = 'http://127.0.0.1:3001/api';

let token = '';
async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const j = await r.json();
  token = j.access_token || j.token;
}
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

const results = [];
function record(name, type, res) {
  if (res.status >= 200 && res.status < 300) {
    results.push({ name, type, status: res.status, ok: true });
    console.log(`✅ ${name} ${type}: ${res.status}`);
  } else {
    results.push({ name, type, status: res.status, ok: false, msg: JSON.stringify(res.data).slice(0, 200) });
    console.log(`❌ ${name} ${type}: ${res.status} - ${JSON.stringify(res.data).slice(0, 150)}`);
  }
}

async function main() {
  await login();
  console.log('登录 OK\n');

  // ============= 1. 项目 project =============
  // 必填: name, customerCode, dateOpen, category, stage, source, state, ownerId
  console.log('=== 1. 项目 project ===');
  const projectC = await api('/project', 'POST', {
    name: 'AI测试项目1',
    customerCode: 'KH202609010002',  // 用已存在的客户编号
    customerId: 674,
    dateOpen: '2026-09-02',
    category: '系统集成',
    stage: '初期沟通',
    source: '独立开发',
    state: '跟踪',
    ownerId: 1,
    currencyCode: '人民币',
    expectedRevenue: '100000',
    amountFinal: '100000',
    plannedCost: '50000',
    description: 'AI 测试项目',
  });
  record('project', 'create', projectC);
  if (projectC.status === 201) {
    const id = projectC.data.id;
    // 模拟 Form.vue loadDetail → save
    const d = (await api(`/project/${id}`)).data;
    const form = Object.assign({}, d);
    form.description = '更新后的描述';
    const u = await api(`/project/${id}`, 'PUT', form);
    record('project', 'update', u);
  }

  // ============= 2. 报价 quotation =============
  console.log('\n=== 2. 报价 quotation ===');
  const quotationC = await api('/quotation', 'POST', {
    code: 'BJ202609020001',
    title: 'AI测试报价1',
    date: '2026-09-02',
    customerName: '区域测试客户',
    contactName: '张联系人',
    currencyCode: '人民币',
    opportunityCode: 'XM202609020001',  // 关联项目编号
    intro: 'AI 测试报价',
  });
  record('quotation', 'create', quotationC);
  if (quotationC.status === 201) {
    const id = quotationC.data.id;
    const d = (await api(`/quotation/${id}`)).data;
    const form = Object.assign({}, d);
    form.intro = '更新后的报价说明';
    const u = await api(`/quotation/${id}`, 'PUT', form);
    record('quotation', 'update', u);
  }

  // ============= 3. 合同 contract =============
  console.log('\n=== 3. 合同 contract ===');
  const contractC = await api('/contract', 'POST', {
    code: 'HT202609020001',
    title: 'AI测试合同1',
    signDate: '2026-09-02',
    customerName: '区域测试客户',
    opportunityCode: 'XM202609020001',
    currencyCode: '人民币',
    ownerName: '管理员',
    signPlace: '北京',
    brand: 'AI',
    startDate: '2026-09-02',
    endDate: '2026-12-31',
    paybackMode: '电汇',
    intro: 'AI 测试合同',
  });
  record('contract', 'create', contractC);
  if (contractC.status === 201) {
    const id = contractC.data.id;
    const d = (await api(`/contract/${id}`)).data;
    const form = Object.assign({}, d);
    form.intro = '更新后的合同说明';
    const u = await api(`/contract/${id}`, 'PUT', form);
    record('contract', 'update', u);
  }

  // ============= 4. 工作日志 worklog =============
  console.log('\n=== 4. 工作日志 worklog ===');
  const worklogC = await api('/worklog', 'POST', {
    code: 'RJ202609020001',
    date: '2026-09-02',
    ownerId: 1,
    content: 'AI 测试工作日志',
    duration: 2.5,
    customerId: 674,
    projectId: null,
  });
  record('worklog', 'create', worklogC);
  if (worklogC.status === 201) {
    const id = worklogC.data.id;
    const d = (await api(`/worklog/${id}`)).data;
    const form = Object.assign({}, d);
    form.content = '更新后的日志内容';
    const u = await api(`/worklog/${id}`, 'PUT', form);
    record('worklog', 'update', u);
  }

  // ============= 5. 库存 inventory =============
  console.log('\n=== 5. 库存 inventory ===');
  const inventoryC = await api('/inventory', 'POST', {
    productName: 'AI测试商品1',
    productModel: 'MODEL-X1',
    manufacturer: '某厂商',
    date: '2026-09-02',
    remark: 'AI 测试库存',
  });
  record('inventory', 'create', inventoryC);
  if (inventoryC.status === 201) {
    const id = inventoryC.data.id;
    const d = (await api(`/inventory/${id}`)).data;
    const form = Object.assign({}, d);
    form.remark = '更新后的库存备注';
    const u = await api(`/inventory/${id}`, 'PUT', form);
    record('inventory', 'update', u);
  }

  // ============= 6. 采购 purchase =============
  console.log('\n=== 6. 采购 purchase ===');
  const purchaseC = await api('/purchase', 'POST', {
    productName: 'AI测试采购1',
    productModel: 'PURCHASE-M1',
    manufacturer: '某厂商',
    date: '2026-09-02',
    remark: 'AI 测试采购',
  });
  record('purchase', 'create', purchaseC);
  if (purchaseC.status === 201) {
    const id = purchaseC.data.id;
    const d = (await api(`/purchase/${id}`)).data;
    const form = Object.assign({}, d);
    form.remark = '更新后的采购备注';
    const u = await api(`/purchase/${id}`, 'PUT', form);
    record('purchase', 'update', u);
  }

  // 汇总
  console.log('\n=== 测试结果汇总 ===');
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`通过: ${ok} / 失败: ${fail}`);
  if (fail > 0) {
    console.log('\n失败详情:');
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  ${r.name} ${r.type}: ${r.status} - ${r.msg}`);
    }
    process.exit(1);
  }
}

main().catch((e) => console.log('主错误:', e.message));
