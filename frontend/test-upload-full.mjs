// 模拟 el-upload 的 customUpload 完整流程
import axios from 'axios';
import { readFile } from 'node:fs/promises';

const BASE = 'http://127.0.0.1:3001/api';

async function main() {
  // 1. login
  const lr = await axios.post(BASE + '/auth/login', {
    username: 'admin', password: '123456',
  });
  const token = lr.data.token;
  console.log('1. login OK');

  // 2. 模拟前端 request 实例
  const request = axios.create({
    baseURL: BASE,
    timeout: 30000,
  });

  // 3. 模拟前端拦截器
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

  // 4. 模拟 el-upload customUpload
  const filePath = 'D:/github/xiangmutest/opencode/zhibang/backend/uploads/1787900722120-555649492.png';
  const fileBuf = await readFile(filePath);

  // 模拟 el-upload 的 options.file（File 对象有 name 属性）
  const options = {
    file: {
      name: 'inventory-test.png',
      size: fileBuf.length,
      type: 'image/png',  // 浏览器 File 对象有 type 字段
    },
  };

  console.log('\n2. customUpload start...');
  const fd = new FormData();
  fd.append('file', new Blob([fileBuf], { type: 'image/png' }), options.file.name);

  try {
    const r = await request.post('/upload', fd);
    console.log('   ✅ z.post OK, r:', JSON.stringify(r));
    const next = [
      r.url ? { url: r.url, name: r.originalname, size: r.size, mimetype: r.mimetype } : { name: r.originalname },
    ];
    console.log('   next:', next);
    console.log('   ✅ 上传成功！');
  } catch (e) {
    console.log('   ❌ 上传失败 catch 触发:');
    console.log('      ', e.message);
  }
}

main().catch((e) => console.log('主错误:', e.message));
