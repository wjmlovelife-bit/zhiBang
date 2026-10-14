// 测试所有模块的 update 流程（模拟 Form.vue loadDetail + save）
const BASE = 'http://127.0.0.1:3001/api';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const j = await r.json();
  return j.access_token || j.token;
}

async function testUpdate(label, url, token) {
  console.log(`\n=== ${label} (${url}) ===`);
  try {
    // 1. detail 接口拿数据
    const dr = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!dr.ok) {
      console.log('  detail 失败:', dr.status);
      return false;
    }
    const d = await dr.json();
    console.log('  detail 字段数:', Object.keys(d).length);

    // 2. 模拟 Form.vue loadDetail（Object.assign）+ save
    const form = {};
    Object.assign(form, d);
    // 给关联数组 override（如果存在）
    if ('items' in d) form.items = d.items || [];
    if ('lines' in d) form.lines = d.lines || [];
    if ('paymentPlans' in d) form.paymentPlans = d.paymentPlans || [];
    if ('contacts' in d) form.contacts = d.contacts || [];

    // 改一个备注/标题字段证明确实是"更新"
    if ('remark' in form) form.remark = (form.remark || '') + ' [test]';
    if ('title' in form) form.title = (form.title || '') + ' [test]';
    if ('name' in form) form.name = (form.name || '') + ' [test]';
    if ('productName' in form) form.productName = (form.productName || '') + ' [test]';
    if ('content' in form) form.content = (form.content || '') + ' [test]';

    const payload = { ...form };
    console.log('  payload 字段数:', Object.keys(payload).length);

    // 3. PUT
    const ur = await fetch(`${BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const text = await ur.text();
    console.log('  PUT 状态:', ur.status);
    if (!ur.ok) {
      console.log('  错误:', text.slice(0, 200));
      return false;
    }
    console.log('  ✅ OK');
    return true;
  } catch (e) {
    console.log('  异常:', e.message);
    return false;
  }
}

async function main() {
  const token = await login();
  console.log('登录 OK');

  const results = {};

  // 1. 客户（已修复，作为基线）
  results['客户 (767)'] = await testUpdate('客户 767', '/customer/767', token);

  // 2. 项目
  results['项目 (1)'] = await testUpdate('项目 1', '/project/1', token);

  // 3. 报价
  results['报价 (1)'] = await testUpdate('报价 1', '/quotation/1', token);

  // 4. 合同
  results['合同 (1)'] = await testUpdate('合同 1', '/contract/1', token);

  // 5. 库存
  results['库存 (1)'] = await testUpdate('库存 1', '/inventory/1', token);

  // 6. 采购
  results['采购 (1)'] = await testUpdate('采购 1', '/purchase/1', token);

  // 7. 工作日志
  results['工作日志 (1)'] = await testUpdate('工作日志 1', '/worklog/1', token);

  console.log('\n========== 汇总 ==========');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v ? '✅' : '❌'} ${k}`);
  }
}

main().catch((e) => console.log('主错误:', e.message));
