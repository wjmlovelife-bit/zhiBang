// 测试有 Decimal 字段的模块：project/quotation/contract
// 用 d 全字段（包含 Prisma.Decimal 实例）测 update
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

async function testFullUpdate(name, idPath) {
  console.log(`\n=== ${name} 全字段 update 测试 ===`);
  const d = (await api(idPath)).data;
  // 列出 Decimal 字段
  const decimalFields = ['expectedRevenue', 'amountFinal', 'plannedCost', 'amountTotal', 'discountValue', 'paymentLimitPct', 'registeredCapital', 'paymentDays', 'settleDay'];
  console.log('Decimal 字段值类型:');
  for (const k of decimalFields) {
    if (d[k] !== undefined) {
      console.log(`  ${k}: ${d[k]} (type: ${typeof d[k]}, isDecimal: ${d[k]?.constructor?.name})`);
    }
  }

  // 模拟 Form.vue loadDetail → save
  const form = Object.assign({}, d);
  form.description = form.description || 'AI测试更新';
  if (name === 'project') form.description = '更新后的描述';
  if (name === 'quotation') form.intro = '更新后的报价说明';
  if (name === 'contract') form.intro = '更新后的合同说明';

  const u = await api(idPath, 'PUT', form);
  if (u.status === 200) {
    console.log(`✅ ${name} update: 200`);
    return true;
  } else {
    console.log(`❌ ${name} update: ${u.status}`);
    console.log(`   错误: ${JSON.stringify(u.data).slice(0, 300)}`);
    return false;
  }
}

async function main() {
  await login();

  // 找现有的 project/quotation/contract
  const projectList = (await api('/project/list?page=1&pageSize=5')).data;
  const quotationList = (await api('/quotation/list?page=1&pageSize=5')).data;
  const contractList = (await api('/contract/list?page=1&pageSize=5')).data;

  const projectId = projectList.items?.[0]?.id;
  const quotationId = quotationList.items?.[0]?.id;
  const contractId = contractList.items?.[0]?.id;

  console.log('现有 project/quotation/contract IDs:', projectId, quotationId, contractId);

  let allOk = true;
  if (projectId) {
    const ok = await testFullUpdate('project', `/project/${projectId}`);
    if (!ok) allOk = false;
  } else {
    console.log('⚠️ 没有 project，跳过');
  }
  if (quotationId) {
    const ok = await testFullUpdate('quotation', `/quotation/${quotationId}`);
    if (!ok) allOk = false;
  } else {
    console.log('⚠️ 没有 quotation，跳过');
  }
  if (contractId) {
    const ok = await testFullUpdate('contract', `/contract/${contractId}`);
    if (!ok) allOk = false;
  } else {
    console.log('⚠️ 没有 contract，跳过');
  }

  console.log(`\n=== 总结: ${allOk ? '全部 ✅' : '有失败 ❌'} ===`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => console.log('主错误:', e.message));
