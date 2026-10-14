/**
 * Smoke: 客户/项目 CRUD 完整流程
 * 流程：登录 → 建客户 → 详情 → 改 → 加 follow → 加联系人 → 继承 → 删除
 *
 * 2026-09-21 修复：
 *  ① assert 函数改为"失败 throw + 累加 failed"，避免 CI 误判全绿；
 *  ② 去掉 5 处 `=== || ===` 恒真断言（POST 期望 201 / PUT 期望 200 / DELETE 期望 200）；
 *  ③ 文件结尾打印 failed 计数并按需 exit 1。
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
  const login = await j('POST', '/auth/login', { username: 'admin', password: '123456' });
  const token = login.data?.token;
  assert(!!token, '1. login admin success');
  if (!token) return;

  // 1. 建客户（必填：name + category + followStage）
  const created = await j('POST', '/customer', {
    name: '烟测客户' + Date.now(),
    category: '终端',
    followStage: '高',
  }, token);
  assert(created.status === 201, '2. create customer → 201');
  const cid = created.data?.id;
  assert(!!cid, '3. customer id returned');
  assert(/^KH\d{8}\d{4}$/.test(created.data?.code || ''), '4. customer code auto-generated');

  // 2. 详情
  const detail = await j('GET', `/customer/${cid}`, null, token);
  assert(detail.status === 200, '5. get customer detail');
  assert(detail.data?.id === cid, '6. detail id matches');

  // 3. 加 follow
  const follow = await j('POST', `/customer/${cid}/follow`, {
    content: '初次拜访', contactName: ['张三'], period: 'am',
  }, token);
  assert(follow.status === 201, '7. add follow → 201');
  assert(follow.data?.id > 0, '8. follow id returned');

  // 4. 改客户
  const updated = await j('PUT', `/customer/${cid}`, {
    name: '改名' + Date.now(), category: '终端', followStage: '中',
  }, token);
  assert(updated.status === 200, '9. update customer → 200');

  // 5. 继承（admin → sales01）
  const inherit = await j('POST', `/customer/${cid}/inherit`, {
    toUserId: 2, reason: '工作交接',
  }, token);
  assert(inherit.status === 200, '10. inherit → 200');

  // 6. 删除
  const del = await j('DELETE', `/customer/${cid}`, null, token);
  assert(del.status === 200, '11. delete customer → 200');

  console.log(`\n=== ${assertions} assertions, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(e => {
  console.error('SMOKE ERROR:', e);
  process.exit(1);
});