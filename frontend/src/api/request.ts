import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { logger } from '@/utils/logger';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截：注入 X-Request-Id 与 Authorization
// R14.3 改：reqId 加 srv- 前缀，与后端 fallback / grep 习惯一致
request.interceptors.request.use((cfg) => {
  cfg.headers['X-Request-Id'] = `srv-${(crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// 响应拦截：
// - 成功：透传 res.data（即 axios 已 unwrap 一次）；R27 统一格式后，res.data = {code:0, data:<原>, ...}
//        再解一层 .data 让前端代码拿到的依然是原数据（保持向后兼容，前端 .vue 完全不用改）
// - 401：当前不在 /login 时才清 token + 整页跳 login（防止登录失败/登录中整页刷新丢输入框）
// - 其它错误：统一 toast
request.interceptors.response.use(
  (res) => {
    // R27 统一响应格式：{code:0, message:'ok', data:<原数据>, requestId} → 解出 data
    // 兼容旧格式（raw response.data）→ wrapped.code 不是 0 → fallback 到 wrapped
    const wrapped = res.data;
    return wrapped && typeof wrapped === 'object' && wrapped.code === 0 && 'data' in wrapped
      ? wrapped.data
      : wrapped;
  },
  (err) => {
    const reqId = err.config?.headers?.['X-Request-Id'] || '-';
    const status = err.response?.status;
    const detail = err.response?.data;
    const msg = detail?.message || err.message || '请求失败';
    const onLogin = location.pathname.startsWith('/login');

    // 关键：401 且已在 login 页时，**不清 token、不跳**，让 login.vue 自己处理（清残留、提示）
    // 这样：用户输入密码错 → 拦截器 toast 一行 "用户名或密码错误" → 输入框保留 → 用户改完再点
    if (status === 401 && !onLogin) {
      logger.warn(`[req=${reqId}] 401 → jump to /login`, err.config?.url, detail);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 改为 SPA 路由跳转（不再整页刷新），并保留原页面路径作为 redirect
      // 避免编辑页面在 token 失效时丢失所有未保存内容
      const currentPath = router.currentRoute.value.fullPath;
      router.push({ path: '/login', query: { redirect: currentPath } });
      return Promise.reject(err);
    }

    // 13. 后端 5xx 时把响应里的 requestId 一并打印并提示（线上排查可直接 grep 日志）
    const serverReqId = detail?.requestId;
    if (status >= 500 && serverReqId) {
      logger.error(`[req=${reqId}] [serverReq=${serverReqId}] 5xx from backend`, detail);
      ElMessage.error(`${msg}（请求ID: ${serverReqId}）`);
      return Promise.reject(err);
    }

    // 其它情况（含 401 在 login 页）正常提示 + 控制台日志，方便定位
    logger.error(`[req=${reqId}] ${err.config?.method?.toUpperCase()} ${err.config?.url} FAILED`, { status, detail });
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);

export default request;
