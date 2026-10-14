/**
 * SysService applyRoleTemplate 集成测试（真 PG）
 *
 * 验证：把角色的菜单/操作授权复制到用户，并先清空旧授权
 */
import { Test } from '@nestjs/testing';
import { SysService } from '@app/modules/sys/sys.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('SysService applyRoleTemplate (Integration)', () => {
  let service: SysService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [SysService, PrismaService],
    }).compile();
    service = module.get<SysService>(SysService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    // 清理
    await prisma.sysUserMenu.deleteMany({ where: { userId: 7 } }).catch(() => {});
    await prisma.sysUserOperation.deleteMany({ where: { userId: 7 } }).catch(() => {});
    await prisma.sysRoleMenu.deleteMany({ where: { roleId: 3 } }).catch(() => {});
    await prisma.sysRoleOperation.deleteMany({ where: { roleId: 3 } }).catch(() => {});
    // 创建角色 3 + 菜单 101/102 + 操作 201/202
    await prisma.sysRole.upsert({
      where: { id: 3 }, update: {},
      create: { id: 3, code: 'test_role', name: '测试角色', dataScope: 4, isSystem: false },
    });
    for (const menuId of [101, 102]) {
      await prisma.sysMenu.upsert({
        where: { id: menuId }, update: {},
        create: { id: menuId, name: `menu${menuId}`, type: 'menu' },
      });
      await prisma.sysRoleMenu.upsert({
        where: { roleId_menuId: { roleId: 3, menuId } }, update: {},
        create: { roleId: 3, menuId },
      });
    }
    for (const opId of [201, 202]) {
      await prisma.sysOperation.upsert({
        where: { id: opId }, update: {},
        create: { id: opId, group: 'g', module: 'm', name: `op${opId}`, code: `op${opId}` },
      });
      await prisma.sysRoleOperation.upsert({
        where: { roleId_operationId: { roleId: 3, operationId: opId } }, update: {},
        create: { roleId: 3, operationId: opId },
      });
    }
    // 用户 7（不存在，确保新建菜单/操作授权复制到用户）
    await prisma.sysUser.upsert({
      where: { id: 7 }, update: {},
      create: { id: 7, username: 'test_user_role', name: '测试用户', password: '123456', isActive: true },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('1. applyRoleTemplate 把角色菜单复制到用户', async () => {
    const r: any = await service.applyRoleTemplate(7, 3);
    expect(r.menuCount).toBe(2);
    expect(r.operationCount).toBe(2);

    const userMenus = await prisma.sysUserMenu.findMany({ where: { userId: 7 } });
    expect(userMenus.length).toBe(2);
    const menuIds = userMenus.map((m) => m.menuId).sort();
    expect(menuIds).toEqual([101, 102]);
  });

  it('2. applyRoleTemplate 把角色操作复制到用户', async () => {
    const userOps = await prisma.sysUserOperation.findMany({ where: { userId: 7 } });
    expect(userOps.length).toBe(2);
    const opIds = userOps.map((o) => o.operationId).sort();
    expect(opIds).toEqual([201, 202]);
  });

  it('3. 二次调用：先清空旧授权再复制（幂等）', async () => {
    const r: any = await service.applyRoleTemplate(7, 3);
    expect(r.menuCount).toBe(2);
    const userMenus = await prisma.sysUserMenu.findMany({ where: { userId: 7 } });
    expect(userMenus.length).toBe(2); // 不是 4（清空 + 重写）
  });
});