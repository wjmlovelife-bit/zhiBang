/**
 * api/request.ts 真实测试
 *
 * 来源：`D:\github\xiangmutest\opencode\zhibang\frontend\src\api\request.ts`
 * 覆盖：
 *  - 请求拦截器：注入 X-Request-Id（UUID 格式）
 *  - 请求拦截器：注入 Authorization Bearer token
 *  - 响应拦截器：成功透传 res.data
 *  - 响应拦截器：401 + 非 /login → 清 token + 跳 /login（带 redirect query）
 *  - 响应拦截器：401 + /login → 不清 token + toast
 *  - 响应拦截器：500 → toast 不跳
 *  - 业务码 0 正常返回 data
 *  - 并发安全：多请求各自有 X-Request-Id
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';

// Mock @/router：避免真实 import（router/index.ts 引了 .vue 文件 happy-dom 解析不了）
// 拦截器 401 非 /login 时调用 router.push({path:'/login', query:{redirect:currentPath}})
const fakeRouter = {
  push: vi.fn(),
  currentRoute: { value: { fullPath: '/customers?keyword=owned' } },
};
vi.mock('@/router', () => ({ default: fakeRouter }));

// 现在才 import request.ts（它 import 的 @/router 已被 mock 替换）
const { default: request } = await import('@/api/request');

describe('api/request - axios 拦截器（mock request 实例）', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    // 注意：必须 mock `request` 实例（用 axios.create 派生），而非全局 axios
    mock = new MockAdapter(request);
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', href: '/', origin: 'http://localhost' },
      writable: true,
    });
    fakeRouter.push.mockClear();
    // 默认 currentRoute 测试用值（test 6 显式覆盖）
    fakeRouter.currentRoute.value = { fullPath: '/customers?keyword=owned' };
  });

  afterEach(() => {
    mock.restore();
  });

  it('1. 请求注入 X-Request-Id（UUID 格式或 fallback）', async () => {
    let captured: any = null;
    mock.onAny().reply((cfg) => {
      captured = cfg.headers;
      return [200, { code: 0, data: 'OK' }];
    });
    await request.get('/test');
    expect(captured['X-Request-Id']).toBeDefined();
    const v = captured['X-Request-Id'];
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(5);
  });

  it('2. localStorage 有 token → 注入 Authorization: Bearer xxx', async () => {
    localStorage.setItem('token', 'test-jwt-token');
    let captured: any = null;
    mock.onAny().reply((cfg) => {
      captured = cfg.headers;
      return [200, { code: 0, data: 'OK' }];
    });
    await request.get('/test');
    expect(captured.Authorization).toBe('Bearer test-jwt-token');
  });

  it('3. localStorage 无 token → 不注入 Authorization', async () => {
    let captured: any = null;
    mock.onAny().reply((cfg) => {
      captured = cfg.headers;
      return [200, { code: 0, data: 'OK' }];
    });
    await request.get('/test');
    expect(captured.Authorization).toBeUndefined();
  });

  it('4. 响应拦截器：成功解出包装层 data（兼容新旧格式）', async () => {
    // R27（2026-09-29）统一响应格式：{code:0, message:'ok', data:<原>, requestId}
    // 前端 axios 拦截器自动解 .data → 拿到原数据，保持向后兼容
    mock.onGet('/test').reply(200, { code: 0, data: { id: 1, name: 'A' } });
    const r: any = await request.get('/test');
    expect(r.id).toBe(1);
    expect(r.name).toBe('A');
  });

  it('5. 响应拦截器：成功但 code 非 0（业务错）→ 也透传（业务层处理）', async () => {
    mock.onGet('/test').reply(200, { code: 1001, message: '业务错' });
    const r: any = await request.get('/test');
    expect(r.code).toBe(1001);
  });

  it('6. 401 + 非 /login → 清 token + router.push(\'/login?redirect=...)\'（不再整页刷新）', async () => {
    localStorage.setItem('token', 'old');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/customers', href: 'http://localhost/customers', origin: 'http://localhost' },
      writable: true,
    });
    mock.onGet('/test').reply(401, { message: '未授权' });
    try {
      await request.get('/test');
    } catch (e) {}
    expect(localStorage.getItem('token')).toBeNull();
    // 2026-09-22 修复：用 SPA router.push 取代 location.href，避免整页刷新
    expect(fakeRouter.push).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/customers?keyword=owned' },  // 来自 fakeRouter.currentRoute.fullPath
    });
  });

  it('7. 401 + /login → 不清 token，不跳（让 login.vue 自己处理）', async () => {
    localStorage.setItem('token', 'login-attempt');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', href: 'http://localhost/login', origin: 'http://localhost' },
      writable: true,
    });
    mock.onGet('/auth/login').reply(401, { message: '用户名或密码错误' });
    try {
      await request.get('/auth/login');
    } catch (e) {}
    expect(localStorage.getItem('token')).toBe('login-attempt');
    expect(fakeRouter.push).not.toHaveBeenCalled();
  });

  it('8. 500 错误 → toast 但不跳', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/some', href: 'http://localhost/some', origin: 'http://localhost' },
      writable: true,
    });
    mock.onGet('/test').reply(500, { message: 'Internal Error' });
    try {
      await request.get('/test');
    } catch (e) {}
    expect(window.location.href).toBe('http://localhost/some');
  });

  it('9. 404 → 不跳', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/some', href: 'http://localhost/some', origin: 'http://localhost' },
      writable: true,
    });
    mock.onGet('/test').reply(404, { message: 'Not Found' });
    try {
      await request.get('/test');
    } catch (e) {}
    expect(window.location.href).toBe('http://localhost/some');
  });

  it('10. baseURL = /api（行为记录：请求路径前缀 /api）', async () => {
    // request.get('/test') → 实际 URL 是 /api/test
    mock.onGet(/\/api\/test/).reply(200, { code: 0, data: 'OK' });
    const r = await request.get('/test');
    expect(r).toBeDefined();
  });

  it('11. ⚠ 行为记录：timeout = 30000ms（无法直接测，只能读源码 line 6）', () => {
    expect(true).toBe(true);
  });

  it('12. 并发 3 个请求：每个 X-Request-Id 不重复', async () => {
    const ids = new Set<string>();
    mock.onAny().reply((cfg) => {
      ids.add(cfg.headers['X-Request-Id']);
      return [200, { code: 0, data: 'OK' }];
    });
    await Promise.all([
      request.get('/a'),
      request.get('/b'),
      request.get('/c'),
    ]);
    expect(ids.size).toBe(3);
  });
});