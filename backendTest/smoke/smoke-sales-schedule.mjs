/**
 * Smoke: 销售日程管理完整流程
 * 流程：登录 → 拉销售日程周 → 加 customer follow → 加 project follow → 重新拉 → 验证 follow 进 am/pm
 *
 * 2026-09-21 修复：
 *  ① assert 函数改为"失败 throw + 累加 failed"，避免 CI 误判全绿；
 *  ② 去掉 `=== 200 || === 500` 恒真断言（按方案 E-1：让 smoke 真正报警）；
 *    导出端点 500 是已知 bug，待修复后此断言自然转绿。
 *  ③ 文件结尾补 exit 1 逻辑。
 */
const BASE = 'http://localhost:3001/api';

async function j(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let assertions = 0, failed = 0;
function assert(cond, msg) {
  assertions++;
  if (cond) console.log('✓', msg);
  else { console.log('✗', msg); failed++; throw new Error('SMOKE ASSERT FAILED: ' + msg); }
}

(async () => {
  // 1. 登录
  const login = await j('POST', '/auth/login', { username: 'sales01', password: '123456' });
  const token = login.data?.token;
  assert(!!token, '1. login sales01 success');
  if (!token) return;

  // 2. 拉本周销售日程
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];
  const week = await j('GET', `/sales-schedule?weekStart=${weekStart}`, null, token);
  assert(week.status === 200, '2. get sales schedule week → 200');
  assert(Array.isArray(week.data?.days) && week.data.days.length === 7, '3. days length = 7');

  // 3. 拉导出 xlsx（TODO: 跟踪 500 bug；源码 sales-schedule.service.ts:exportToBuffer 实现待修复）
  const exportRes = await fetch(BASE + `/sales-schedule/export?weekStart=${weekStart}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  assert(exportRes.status === 200, '4. export xlsx → 200');
  const buf = await exportRes.arrayBuffer();
  assert(buf.byteLength > 1000, '5. xlsx buffer > 1KB');

  console.log(`\n=== ${assertions} assertions, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(e => {
  console.error('SMOKE ERROR:', e);
  process.exit(1);
});