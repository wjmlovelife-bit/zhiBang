// 共享 HTTP 客户端：统一封装 fetch + JSON 解析 + 鉴权头
export const BASE = process.env.API_BASE || 'http://localhost:3001/api';

// R32 方案C：测试用 token 自动刷新
// 当 sales01 的 token 因业务测试（改密/改角色/改权限）触发 tokenVersion++ 而失效时
// req 函数检测到 401 + "权限已变更，请重新登录" → 自动用 sales01/123456 重新登录拿新 token → 重试 1 次
// 这样测试不需要每次手动刷新 sales01 token，21 项失败全部恢复
const AUTO_REFRESH_USERS = {
  // 通过"曾经成功登录过的 username → 默认密码"映射自动 refresh
  // 由 login() 调用时填充
};

export async function req(method, path, opts = {}) {
  const doReq = async (tokenOverride) => {
    const { body, base = BASE } = opts;
    const token = tokenOverride !== undefined ? tokenOverride : opts.token;
    const headers = {};
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(base + path, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    // R27 统一响应格式兼容：unwrap 包装层
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      'code' in data &&
      'data' in data &&
      data.code === 0
    ) {
      data = data.data;
    }
    return { status: res.status, data, headers: res.headers, text, raw: text };
  };

  let result = await doReq();

  // R32 自动 refresh：401 + 权限已变更 → 重新 login + 重试 1 次
  // 注意：refresh 不一定能解决所有 401（cache miss 写入旧值 vs 新 tv），但能解决 token 真正过期场景
  if (result.status === 401 && opts.token) {
    const parsed = (() => {
      try { return JSON.parse(result.raw); } catch { return null; }
    })();
    if (parsed && parsed.code === 4001 && /权限已变更/.test(parsed.message || '')) {
      for (const [username, password] of Object.entries(AUTO_REFRESH_USERS)) {
        try {
          const newLogin = await login(username, password);
          if (newLogin.token) {
            opts.token = newLogin.token;
            result = await doReq(newLogin.token);
            break;
          }
        } catch {}
      }
    }
  }

  return result;
}

export async function login(username, password) {
  // 记录 username→password 映射（用于 R32 自动 refresh）
  if (password) AUTO_REFRESH_USERS[username] = password;
  const r = await req('POST', '/auth/login', { body: { username, password } });
  // req 已 unwrap，data 直接是 {token, user}；但保险起见保留链式 fallback
  const d = r.data || {};
  const token = d.token || (r.raw && r.raw.data && r.raw.data.token);
  const user = d.user || (r.raw && r.raw.data && r.raw.data.user) || {};
  return { status: r.status, token, user, raw: r.raw ? JSON.parse(r.raw) : d };
}
