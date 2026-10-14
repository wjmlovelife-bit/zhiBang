// 局域网压测：绕过 cloudflared，直接打内网 8080/3001
// 3 套：纯后端 3001 / 经前端 8080 / 仅登录 vs 登录+列表

const BACKEND = 'http://172.16.20.58:3001';
const FRONTEND = 'http://172.16.20.58:8080';

async function httpRequest(base, path, method = 'GET', headers = {}, body = null) {
  const url = base + path;
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
  const errRate = totalReq === 0 ? 0 : (errors / totalReq) * 100;
  const rps = totalReq / durationSec;
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const max = Math.max(...durations, 0);
  console.log(
    `  [${label}] req=${totalReq} err=${errors}(${errRate.toFixed(2)}%) RPS=${rps.toFixed(1)} ` +
    `min=${durations.length ? Math.min(...durations).toFixed(0) : 0}ms ` +
    `p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms max=${max.toFixed(0)}ms`,
  );
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
      while (inFlight.size < c && Date.now() < endTime) {
        const p = scenario();
        inFlight.add(p);
        p.then(r => {
          durations.push(r.elapsedMs);
          totalReq++;
          if (r.status < 200 || r.status >= 300 || r.error) errors++;
        });
        await new Promise(r => setTimeout(r, 3));
      }
      if (inFlight.size >= c) {
        await Promise.race(inFlight).catch(() => {});
      }
    }
    await Promise.allSettled([...inFlight]);
    stats(`${label} (并发 ${c})`, durations, errors, totalReq, (Date.now() - start) / 1000);
  }
}

// 共享 token（带重试）
let cachedToken = null;
let cachedTokenTime = 0;
async function getToken(base) {
  if (cachedToken && Date.now() - cachedTokenTime < 5 * 60 * 1000) return cachedToken;
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '123456' }),
      });
      const t = await r.text();
      const j = JSON.parse(t);
      if (j.token) {
        cachedToken = j.token;
        cachedTokenTime = Date.now();
        return cachedToken;
      }
      lastErr = new Error('no token in response');
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw lastErr || new Error('getToken failed');
}

// ============ 场景定义 ============

// S1: 纯登录（直接打后端 3001）
function s1LoginBackend() {
  return httpRequest(BACKEND, '/api/auth/login', 'POST', {}, {
    username: 'admin', password: '123456',
  });
}

// S2: 登录+查列表（直接打后端 3001，复用 token）
async function s2ListBackend() {
  const token = await getToken(BACKEND);
  return httpRequest(BACKEND, '/api/customer/list?page=1&pageSize=20', 'GET', {
    Authorization: 'Bearer ' + token,
  });
}

// S3: 登录+查列表（经前端 8080，模拟用户实际访问）
async function s3ListFrontend() {
  const token = await getToken(BACKEND);
  return httpRequest(FRONTEND, '/api/customer/list?page=1&pageSize=20', 'GET', {
    Authorization: 'Bearer ' + token,
  });
}

// S4: 写 - 创建客户（直接打后端 3001）
async function s4CreateBackend() {
  const token = await getToken(BACKEND);
  return httpRequest(BACKEND, '/api/customer', 'POST', {
    Authorization: 'Bearer ' + token,
  }, {
    name: '压测_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
    category: '终端公司',
    followStage: '高',
    industry: '电子',
    currencyCode: '人民币',
  });
}

// ============ 主入口 ============

(async () => {
  console.log(`局域网 IP: 172.16.20.58`);
  console.log(`后端  : ${BACKEND}`);
  console.log(`前端  : ${FRONTEND} (serve-frontend 反代到 3001)`);
  console.log(`每档 15s，并发档位: 20, 50, 100, 150, 200, 300, 500\n`);

  await ramp('S1 纯登录-后端',   s1LoginBackend,  [20, 50, 100, 150, 200, 300, 500], 15);
  await ramp('S2 查列表-后端',   s2ListBackend,   [20, 50, 100, 150, 200, 300], 15);
  await ramp('S3 查列表-前端',   s3ListFrontend,  [20, 50, 100, 150, 200], 15);
  await ramp('S4 创建客户-后端', s4CreateBackend, [20, 50, 100, 150, 200], 15);

  console.log('\n========== 完成 ==========');
})();
