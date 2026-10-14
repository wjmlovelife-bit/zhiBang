/**
 * AuthService 单元测试（mock Prisma）
 * 覆盖：
 * 1. validateUser: 用户名匹配成功
 * 2. validateUser: 姓名匹配成功
 * 3. validateUser: 用户不存在 → throw
 * 4. validateUser: 密码错误 → throw
 * 5. validateUser: 用户被禁用 → throw
 * 6. login: 成功返回 token + user 信息
 * 7. login: dataScope 取所有角色最小值
 * 8. login: 无角色 dataScope=4
 * 9. clearPasswordFlag: 成功清标记位
 */
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '@app/modules/auth/auth.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('AuthService', () => {
  let service: AuthService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-jwt-secret', signOptions: { expiresIn: '24h' } })],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    // 默认 mock computePermissions 依赖（admin/user 各一套）
    setMock(mock, 'sysOperation.findMany', []);
    setMock(mock, 'sysUserOperation.findMany', []);
    setMock(mock, 'sysUserMenu.findMany', []);
    setMock(mock, 'sysRoleMenu.findMany', []);
    setMock(mock, 'sysRoleOperation.findMany', []);
  });

  afterEach(() => {
    resetMockPrisma(mock);
  });

  // ============================================================
  // validateUser
  // ============================================================
  describe('validateUser', () => {
    it('1. should return user when username + password correct', async () => {
      const fakeUser = {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, mustResetPassword: false, deptId: 1, dept: { id: 1, name: '总' },
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      };
      setMock(mock, 'sysUser.findFirst', fakeUser);

      const result = await service.validateUser('admin', '123456');
      expect(result.id).toBe(1);
      expect(result.username).toBe('admin');
      // 验证查询条件：username 或 name 匹配
      const calls = mock.sysUser.findFirst.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const arg = calls[0][0];
      expect(arg.where.OR).toEqual([
        { username: 'admin' },
        { name: 'admin' },
      ]);
    });

    it('2. should return user when name (姓名) matches', async () => {
      const fakeUser = {
        id: 2, username: 'sales01', name: '张三', password: '123456',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [{ role: { id: 2, code: 'sales', dataScope: 4 } }],
      };
      setMock(mock, 'sysUser.findFirst', fakeUser);

      const result = await service.validateUser('张三', '123456');
      expect(result.id).toBe(2);
      expect(result.username).toBe('sales01');
    });

    it('3. should throw UnauthorizedException when user not found', async () => {
      setMock(mock, 'sysUser.findFirst', null);
      await expect(service.validateUser('nobody', 'xxx')).rejects.toThrow(UnauthorizedException);
    });

    it('4. should throw UnauthorizedException when password wrong', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: 'DIFFERENT',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [],
      });
      await expect(service.validateUser('admin', '123456')).rejects.toThrow('密码错误');
    });

    it('5. should throw when user isActive=false', async () => {
      setMock(mock, 'sysUser.findFirst', {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: false, mustResetPassword: false, deptId: null, dept: null,
        roles: [],
      });
      await expect(service.validateUser('admin', '123456')).rejects.toThrow('禁用');
    });
  });

  // ============================================================
  // login
  // ============================================================
  describe('login', () => {
    it('6. should return { token, user } on success', async () => {
      const fakeUser = {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, isAdmin: true, mustResetPassword: true, deptId: 1,
        dept: { id: 1, name: '总经办' },
        roles: [{ role: { id: 1, code: 'admin', dataScope: 1 } }],
      };
      setMock(mock, 'sysUser.findFirst', fakeUser);
      // computePermissions 内部需要 mock 三个 Prisma 查询
      setMock(mock, 'sysUserMenu.findMany', []);
      setMock(mock, 'sysRoleMenu.findMany', []);
      setMock(mock, 'sysRoleOperation.findMany', []);

      const result = await service.login('admin', '123456');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toMatchObject({
        id: 1, username: 'admin', name: '管理员',
        isAdmin: true, roleCodes: ['admin'], dataScope: 1,
        mustResetPassword: true,
        deptName: '总经办',
      });
      expect(result.user.permissions).toBeDefined();
    });

    it('7. dataScope = min(all role.dataScope)', async () => {
      const fakeUser = {
        id: 2, username: 'sales01', name: '张三', password: '123456',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [
          { role: { id: 2, code: 'sales', dataScope: 4 } },
          { role: { id: 4, code: 'leader', dataScope: 2 } },
        ],
      };
      setMock(mock, 'sysUser.findFirst', fakeUser);

      const result = await service.login('sales01', '123456');
      expect(result.user.dataScope).toBe(2); // min(4, 2)
    });

    it('8. dataScope = 4 when no roles', async () => {
      const fakeUser = {
        id: 9, username: 'norole', name: '无角色', password: '123456',
        isActive: true, mustResetPassword: false, deptId: null, dept: null,
        roles: [],
      };
      setMock(mock, 'sysUser.findFirst', fakeUser);

      const result = await service.login('norole', '123456');
      expect(result.user.dataScope).toBe(4);
      expect(result.user.roleCodes).toEqual([]);
    });
  });

  // ============================================================
  // clearPasswordFlag
  // ============================================================
  describe('clearPasswordFlag', () => {
    it('9. should clear mustResetPassword to false', async () => {
      setMock(mock, 'sysUser.update', { id: 1, mustResetPassword: false });
      const result = await service.clearPasswordFlag(1);
      expect(result.ok).toBe(true);
      const call = mock.sysUser.update.mock.calls[0][0];
      expect(call.where.id).toBe(1);
      expect(call.data.mustResetPassword).toBe(false);
    });
  });
});
