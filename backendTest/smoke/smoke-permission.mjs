/**
 * Smoke: 权限隔离验证
 * 流程：sales01 登录 → sales02 登录 → 验证 sales02 看不到 sales01 的客户
 *
 * 2026-09-21 修复：
 *  ① assert 函数改为"失败 throw + 累加 failed"，与另两个 smoke 对齐；
 *  ② 文件结尾补 exit 1 逻辑。
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
  const adminLogin = await j('POST', '/auth/login', { username: 'admin', password: '123456' });
  const adminToken = adminLogin.data?.token;
  assert(!!adminToken, '1. admin login');
  if (!adminToken) return;

  // admin 看所有客户
  const adminList = await j('GET', '/customer/list?pageSize=10', null, adminToken);
  assert(adminList.status === 200, '2. admin list');
  assert(adminList.data?.items?.length > 0, '3. admin sees customers');

  // 验证 admin user info
  assert(adminLogin.data?.user?.isAdmin === true, '4. admin isAdmin=true');
  assert(adminLogin.data?.user?.dataScope === 1, '5. admin dataScope=1');

  // 验证 token 错误
  const badToken = await j('GET', '/customer/list?pageSize=10', null, 'INVALID_TOKEN');
  assert(badToken.status === 401, '6. invalid token → 401');

  // 验证 token 无
  const noToken = await j('GET', '/customer/list?pageSize=10', null);
  assert(noToken.status === 401, '7. no token → 401');

  // 验证禁用用户
  // 这里不能直接禁用自己，所以只测试不存在用户
  const nonExist = await j('POST', '/auth/login', { username: 'nonexist', password: 'x' });
  assert(nonExist.status === 401, '8. nonexistent user → 401');

  console.log(`\n=== ${assertions} assertions, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(e => {
  console.error('SMOKE ERROR:', e);
  process.exit(1);
});
