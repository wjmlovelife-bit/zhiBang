// 阶梯压测：场景 1 = 纯登录，场景 2 = 登录后查列表，场景 3 = 写操作
// 跑完输出每档并发下的 P50/P95/P99/最大延迟/错误率/RPS

const BASE = 'https://termination-booking-countries-breach.trycloudflare.com';

async function httpRequest(path, method = 'GET', headers = {}, body = null) {
  const url = BASE + path;
  const start = process.hrtime.bigint();
  let res, text, error = null;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    text = await res.text();
  } catch (e) {
    error = e.message;
  }
  const elapsedNs = process.hrtime.bigint() - start;
  return {
    status: res ? res.status : 0,
    elapsedMs: Number(elapsedNs) / 1e6,
    error,
    len: text ? text.length : 0,
  };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function stats(label, durations, errors, totalReq, durationSec) {
  const okReq = totalReq - errors;
  const rps = (totalReq / durationSec).toFixed(1);
  const errRate = ((errors / totalReq) * 100).toFixed(2);
  const p50 = percentile(durations, 50).toFixed(1);
  const p95 = percentile(durations, 95).toFixed(1);
  const p99 = percentile(durations, 99).toFixed(1);
  const max = Math.max(...durations, 0).toFixed(1);
  const min = Math.min(...durations, Infinity).toFixed(1);
  console.log(`\n[${label}] 并发 ${durations.length === 0 ? '?' : '已跑'} 请求数 ${totalReq} 错误 ${errors} (${errRate}%) RPS=${rps}`);
  console.log(`  延迟: min=${min}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${max}ms`);
}

async function ramp(label, scenario, concurrencyLevels, durationSec) {
  console.log(`\n========== ${label} ==========`);
  for (const c of concurrencyLevels) {
    const durations = [];
    let errors = 0;
    const start = Date.now();
    const endTime = start + durationSec * 1000;
    const inFlight = new Set();
    let totalReq = 0;

    while (Date.now() < endTime) {
      // 控并发
      while (inFlight.size < c && Date.now() < endTime) {
        const p = scenario().finally(r => {
          inFlight.delete(p);
        });
        inFlight.add(p);
        p.then(r => {
          durations.push(r.elapsedMs);
          totalReq++;
          if (r.status < 200 || r.status >= 300 || r.error) errors++;
        });
        // 一点点间隔，避免瞬间起 c 个
        await new Promise(r => setTimeout(r, 5));
      }
      // 等一批完成再放下一批
      if (inFlight.size >= c) {
        await Promise.race(inFlight);
      }
    }
    await Promise.allSettled([...inFlight]);
    stats(`${label} (并发 ${c})`, durations, errors, totalReq, (Date.now() - start) / 1000);
  }
}

// ============ 场景 1：纯登录 ============
async function scenarioLogin() {
  return httpRequest('/api/auth/login', 'POST', {}, { username: 'admin', password: '123456' });
}

// ============ 场景 2：登录后调 /customer/list ============
async function scenarioList() {
  const login = await httpRequest('/api/auth/login', 'POST', {}, { username: 'admin', password: '123456' });
  if (login.status !== 201) return login;
  let token = null;
  try {
    const j = JSON.parse(login._raw || '');
    token = j.token;
  } catch {}
  if (!token) {
    // 重新跑一次抓原始 text
    const r = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '123456' }),
    });
    const t = await r.text();
    token = JSON.parse(t).token;
  }
  const start = process.hrtime.bigint();
  let res, error = null, len = 0;
  try {
    res = await fetch(BASE + '/api/customer/list?page=1&pageSize=20', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
    const txt = await res.text();
    len = txt.length;
  } catch (e) {
    error = e.message;
  }
  return {
    status: res ? res.status : 0,
    elapsedMs: Number(process.hrtime.bigint() - start) / 1e6,
    error,
    len,
  };
}

// ============ 场景 3：写 - 创建客户（先登录拿 token 复用） ============
let sharedToken = null;
async function getSharedToken() {
  if (sharedToken) return sharedToken;
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const t = await r.text();
  sharedToken = JSON.parse(t).token;
  return sharedToken;
}
async function scenarioWrite() {
  const token = await getSharedToken();
  const start = process.hrtime.bigint();
  let res, error = null, len = 0;
  try {
    res = await fetch(BASE + '/api/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        name: '压测客户_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        category: '终端公司',
        followStage: '高',
        industry: '电子',
        currencyCode: '人民币',
      }),
    });
    const txt = await res.text();
    len = txt.length;
  } catch (e) {
    error = e.message;
  }
  return {
    status: res ? res.status : 0,
    elapsedMs: Number(process.hrtime.bigint() - start) / 1e6,
    error,
    len,
  };
}

// ============ 主入口 ============
(async () => {
  console.log(`目标: ${BASE}`);
  console.log(`压测时长: 每档 15s，并发档位: 1, 5, 20, 50, 100, 200`);

  await ramp('场景1 纯登录', scenarioLogin, [1, 5, 20, 50, 100, 200], 15);
  await ramp('场景2 登录后查列表', scenarioList, [1, 5, 20, 50, 100, 200], 15);
  await ramp('场景3 创建客户', scenarioWrite, [1, 5, 20, 50, 100], 15);

  console.log('\n========== 完成 ==========');
})();
