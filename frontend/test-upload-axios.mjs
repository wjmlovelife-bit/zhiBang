// 用 axios 1.x 模拟前端实际行为
import axios from 'axios';
import { readFile } from 'node:fs/promises';

const BASE = 'http://127.0.0.1:3001/api';

async function main() {
  // 1. login
  const lr = await axios.post(BASE + '/auth/login', {
    username: 'admin', password: '123456',
  });
  const token = lr.data.access_token || lr.data.token;
  console.log('1. login OK, token:', token.slice(0, 20) + '...');

  // 2. 创建 axios 实例模拟前端（Node 用完整 URL，浏览器用 '/api'）
  const request = axios.create({
    baseURL: 'http://127.0.0.1:3001/api',
    timeout: 30000,
  });

  // 3. 模拟前端拦截器
  request.interceptors.request.use((cfg) => {
    cfg.headers['X-Request-Id'] = (globalThis.crypto)?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    cfg.headers['Authorization'] = `Bearer ${token}`;
    console.log('  拦截器后 headers:', Object.keys(cfg.headers).slice(0, 5));
    console.log('  baseURL:', cfg.baseURL);
    return cfg;
  });

  // 4. 模拟响应拦截器（与前端 request.ts 一致）
  request.interceptors.response.use(
    (res) => res.data,
    (err) => {
      console.log('  响应错误:', err.response?.status, err.response?.data);
      return Promise.reject(err);
    },
  );

  // 5. 上传文件
  const filePath = 'D:/github/xiangmutest/opencode/zhibang/backend/uploads/1787900722120-555649492.png';
  const fileBuf = await readFile(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([fileBuf]), 'inventory-test.png');

  console.log('\n2. axios post /upload...');
  try {
    const r = await request.post('/upload', fd);
    console.log('   成功:', JSON.stringify(r));
  } catch (e) {
    console.log('   失败:', e.response?.status, e.response?.data);
    console.log('   message:', e.message);
  }
}

main().catch((e) => console.log('主错误:', e.message));
