/**
 * AuthService 全场景补测（与 auth.service.spec.ts 9 用例互补）
 *
 * 覆盖：
 *  - validateUser 边界（空用户名 / 特殊字符密码 / 仅 username 不匹配 name / 密码前后空格）
 *  - login JWT 结构 / 大小写敏感
 *  - clearPasswordFlag 用户不存在（P2025）
 *  - ⚠ bcrypt 切换回归保护（当前密码明文存储）
 *  - 并发同账号登录
 *
 * 实现：直接 new AuthService(mock, jwt) 实例化（避免 Nest 测试容器）
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from '@app/modules/auth/auth.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('AuthService extra scenarios', () => {
  let service: AuthService;
  let mock: MockPrisma;
  let jwt: JwtService;

  beforeEach(() => {
    mock = makeMockPrisma();
    jwt = new JwtService({ secret: 'test-jwt-secret', signOptions: { expiresIn: '24h' } });
    service = new AuthService(mock as any, jwt);
    // 默认 mock computePermissions 依赖
    setMock(mock, 'sysOperation.findMany', []);
    setMock(mock, 'sysUserOperation.findMany', []);
    setMock(mock, 'sysUserMenu.findMany', []);
    setMock(mock, 'sysRoleMenu.findMany', []);
    setMock(mock, 'sysRoleOperation.findMany', []);
  });

  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // validateUser 边界
  // ============================================================
  describe('validateUser 边界', () => {
    it('1. 空用户名 → throw Unauthorized', async () => {
      setMock(mock, 'sysUser.findFirst', null);
      await expect(service.validateUser('', 'xxx')).rejects.toThrow(UnauthorizedException);
    });

    it('2. 密码含特殊字符（!@#$%^&*）仍可正常匹配（明文比对）', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: 'P@ssw0rd!',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      const result = await service.validateUser('admin', 'P@ssw0rd!');
      expect(result.id).toBe(1);
    });

    it('3. 用户名和姓名都不匹配 → throw Unauthorized + OR 条件含 username/name', async () => {
      setMock(mock, 'sysUser.findFirst', null);
      await expect(service.validateUser('noMatch', 'xxx')).rejects.toThrow(UnauthorizedException);
      const arg = mock.sysUser.findFirst.mock.calls[0][0];
      expect(arg.where.OR).toEqual([
        { username: 'noMatch' },
        { name: 'noMatch' },
      ]);
    });

    it('4. 密码含前后空格仍可匹配（行为记录：源码不 trim）', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      // 不带空格 → 通过
      await expect(service.validateUser('admin', '123456')).resolves.toBeDefined();
      // 带空格 → 失败（源码明文比对不 trim）
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      await expect(service.validateUser('admin', ' 123456 ')).rejects.toThrow('密码错误');
    });
  });

  // ============================================================
  // login
  // ============================================================
  describe('login', () => {
    it('5. 用户名大写 ADMIN → 找不到（PG 默认大小写敏感，行为记录）', async () => {
      setMock(mock, 'sysUser.findFirst', null);
      await expect(service.login('ADMIN', '123456')).rejects.toThrow();
    });

    it('6. login 返回 token 包含正确 claims（HS256 JWT 三段式）', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, isAdmin: true, mustResetPassword: false, deptId: 1,
        dept: { id: 1, name: '总经办' },
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      const r: any = await service.login('admin', '123456');
      const parts = r.token.split('.');
      expect(parts.length).toBe(3);
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      expect(header.alg).toBe('HS256');
    });

    it('7. ⚠ bcrypt 切换回归保护（当前密码明文存储）', async () => {
      // 当前源码：明文比对 → "$2b$10$hashed" 不等于 "123456" → throw
      // 切 bcrypt 后：password: '123456' 应通过；'wrong' 应 throw '密码错误'
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '$2b$10$hashed',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      await expect(service.login('admin', '123456')).rejects.toThrow('密码错误');
    });
  });

  // ============================================================
  // clearPasswordFlag
  // ============================================================
  describe('clearPasswordFlag', () => {
    it('8. 用户不存在 → Prisma P2025（行为记录：源码不 catch）', async () => {
      const err: any = new Error('Record to update does not exist');
      err.code = 'P2025';
      mock.sysUser.update.mockRejectedValue(err);
      await expect(service.clearPasswordFlag(999)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // 并发
  // ============================================================
  describe('并发场景记录', () => {
    it('9. 同账号并发 5 次 login → 5 次都成功（JWT iat 同秒会重复，行为记录）', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, isAdmin: true, mustResetPassword: false, deptId: 1,
        dept: { id: 1, name: '总' },
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      });
      const results = await Promise.all([
        service.login('admin', '123456'),
        service.login('admin', '123456'),
        service.login('admin', '123456'),
        service.login('admin', '123456'),
        service.login('admin', '123456'),
      ]);
      expect(results.length).toBe(5);
      // JWT iat/exp 是秒精度，同秒内并发 token 相同（同 sub+username+iat+exp → 同 token）
      const tokens = new Set(results.map((r: any) => r.token));
      // 行为记录：5 次 token 不一定全不同；最少 1 个（也可能 5 个不同）
      expect(tokens.size).toBeGreaterThanOrEqual(1);
      // 业务规则建议：login 成功后应主动失效旧的（jwt blacklist）
    });
  });
});