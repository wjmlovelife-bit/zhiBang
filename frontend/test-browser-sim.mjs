// 完整模拟 user 浏览器环境：axios + baseURL='/api' + 8080 代理
import axios from 'axios';
import { readFile } from 'node:fs/promises';

const BASE = 'http://127.0.0.1:8080/api';  // 通过 8080 代理

async function main() {
  // 1. login 通过 8080
  const lr = await axios.post(BASE + '/auth/login', {
    username: 'admin', password: '123456',
  });
  const token = lr.data.token;
  console.log('1. login OK');

  // 2. 完全模拟前端 request 实例
  const request = axios.create({
    baseURL: '/api',  // 浏览器环境，axios 1.x 不会报错
    timeout: 30000,
  });

  // 3. 完全模拟前端拦截器
  request.interceptors.request.use((cfg) => {
    cfg.headers['X-Request-Id'] = `${Date.now()}-${Math.random()}`;
    cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });
  request.interceptors.response.use(
    (res) => res.data,
    (err) => {
      console.log('  ❌ 拦截器 catch 触发:');
      console.log('     status:', err.response?.status);
      console.log('     data:', JSON.stringify(err.response?.data));
      console.log('     message:', err.message);
      return Promise.reject(err);
    },
  );

  // 4. 上传（模拟 el-upload）
  const filePath = 'D:/github/xiangmutest/opencode/zhibang/backend/uploads/1787900722120-555649492.png';
  const fileBuf = await readFile(filePath);

  console.log('\n2. customUpload start...');
  const fd = new FormData();
  fd.append('file', new Blob([fileBuf], { type: 'image/png' }), 'test.png');

  try {
    const r = await request.post('/upload', fd);
    console.log('   ✅ 上传成功！', JSON.stringify(r).slice(0, 100));
  } catch (e) {
    console.log('   ❌ 上传失败:', e.message);
  }
}

main().catch((e) => console.log('主错误:', e.message));
