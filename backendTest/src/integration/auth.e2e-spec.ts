/**
 * Auth 真 PG 测试（zhibang_test）
 * 流程：
 * 1. seed admin 用户 + 角色
 * 2. 登录成功
 * 3. 登录密码错
 * 4. 登录用户不存在
 * 5. JWT 解析 user 信息
 */
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from '@app/modules/auth/auth.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('Auth (Integration)', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-jwt-secret', signOptions: { expiresIn: '1h' } })],
      providers: [AuthService, PrismaService],
    }).compile();
    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    // 清理可能残留（按 id 从大到小删，但 cascade 是关键）
    await prisma.sysUserRole.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUserOperation.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUserMenu.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUser.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysRoleOperation.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysRoleMenu.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysRole.deleteMany({ where: {} }).catch(() => {});
    // 用 upsert + 固定 username='admin'（service.login 用 'admin'）
    const role = await prisma.sysRole.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, code: 'admin', name: '管理员', dataScope: 1, isActive: true },
    });
    const user = await prisma.sysUser.upsert({
      where: { id: 1 },
      update: { password: '123456', isActive: true, isAdmin: true, mustResetPassword: false },
      create: {
        id: 1, username: 'admin', name: '管理员', password: '123456',
        isActive: true, isAdmin: true, mustResetPassword: false,
      },
    });
    await prisma.sysUserRole.upsert({
      where: { userId_roleId: { userId: 1, roleId: 1 } },
      update: {},
      create: { userId: 1, roleId: 1 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. login success → token + user info', async () => {
    const r = await service.login('admin', '123456');
    expect(r.token).toBeDefined();
    expect(r.user.id).toBe(1);
    expect(r.user.username).toBe('admin');
    expect(r.user.isAdmin).toBe(true);
    expect(r.user.roleCodes).toContain('admin');
    expect(r.user.dataScope).toBe(1);
  });

  it('2. login wrong password → UnauthorizedException', async () => {
    await expect(service.login('admin', 'WRONG')).rejects.toThrow();
  });

  it('3. login non-existent user → UnauthorizedException', async () => {
    await expect(service.login('nobody', '123456')).rejects.toThrow();
  });

  it('4. JWT sign/verify roundtrip', async () => {
    const jwt = new JwtService({ secret: 'test-jwt-secret', signOptions: { expiresIn: '1h' } });
    const token = jwt.sign({ sub: 1, username: 'admin' });
    const decoded = jwt.verify(token);
    expect(decoded.sub).toBe(1);
    expect(decoded.username).toBe('admin');
  });

  it('5. clearPasswordFlag updates user', async () => {
    await prisma.sysUser.update({ where: { id: 1 }, data: { mustResetPassword: true } });
    await service.clearPasswordFlag(1);
    const u: any = await prisma.sysUser.findUnique({ where: { id: 1 } });
    expect(u.mustResetPassword).toBe(false);
  });
});
