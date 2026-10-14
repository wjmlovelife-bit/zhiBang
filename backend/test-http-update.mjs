// 模拟真实 HTTP 请求：登录后调 customerApi.update
import axios from 'axios';

const BASE = 'http://127.0.0.1:3001/api';

async function main() {
  // 登录
  const login = await axios.post(`${BASE}/auth/login`, { username: 'admin', password: '123456' });
  const token = login.data?.access_token || login.data?.token;
  console.log('login OK, token:', token?.slice(0, 20));

  // 拿到 detail（模拟 Form.vue loadDetail）
  const d = (await axios.get(`${BASE}/customer/674`, { headers: { Authorization: `Bearer ${token}` } })).data;
  console.log('detail 字段数:', Object.keys(d).length);

  // 模拟 Form.vue loadDetail: Object.assign(form, d, { contacts: d.contacts || [] })
  const form = {};
  Object.assign(form, d, { contacts: d.contacts || [] });

  // 模拟 save: payload = { ...form }
  const payload = { ...form };
  console.log('Payload 字段数:', Object.keys(payload).length);
  console.log('Payload follows:', Array.isArray(payload.follows) ? `array[${payload.follows.length}]` : typeof payload.follows);
  console.log('Payload inherits:', Array.isArray(payload.inherits) ? `array[${payload.inherits.length}]` : typeof payload.inherits);
  console.log('Payload owner:', typeof payload.owner);

  // 调 update
  try {
    const r = await axios.put(`${BASE}/customer/674`, payload, { headers: { Authorization: `Bearer ${token}` } });
    console.log('update OK, 返回:', r.status);
  } catch (e) {
    console.log('update ERR:', e.response?.status, e.response?.data?.message?.slice(0, 500));
  }
}

main()
  .catch((e) => console.log('主错误:', e.message));
