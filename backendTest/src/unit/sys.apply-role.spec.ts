/**
 * SysService.applyRoleTemplate 单元测试（覆盖 modules/sys/sys.service.ts:301）
 *
 * 直接实例化（仅依赖 PrismaService）。验证：把角色菜单/操作授权复制到用户，并先清空旧授权。
 * 文档 P2-6 用例 1/2 据此编写。
 *
 * 注意：源码 $transaction 使用【数组形式】`$transaction([...op], {isolationLevel})`，
 * 数组内每个操作都是 `this.prisma.sysUserMenu.createMany(...)` 这类直接调用，
 * 因此断言落在主 mock 的 `sysUserMenu.*` / `sysUserOperation.*` 上，而不是事务回调对象。
 */
import { SysService } from '@app/modules/sys/sys.service';
import { makeMockPrisma, MockPrisma, resetMockPrisma } from '../setup/prisma-mock';

describe('SysService.applyRoleTemplate', () => {
  let service: SysService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new SysService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  it('1. 复制角色菜单到用户（写入 menuId 列表，并先清空旧授权）', async () => {
    // 角色 3 的菜单 [101, 102]
    mock.sysRoleMenu.findMany.mockResolvedValue([{ menuId: 101 }, { menuId: 102 }] as any);
    mock.sysRoleOperation.findMany.mockResolvedValue([] as any);

    // 数组形式 $transaction 不传入回调，这里让它默认 resolve 即可（源码不使用其返回值）
    const r: any = await service.applyRoleTemplate(7, 3);
    expect(r.menuCount).toBe(2);
    expect(r.operationCount).toBe(0);

    // 先清空旧授权
    expect(mock.sysUserMenu.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(mock.sysUserOperation.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    // 再写入新菜单授权
    expect(mock.sysUserMenu.createMany).toHaveBeenCalledWith({
      data: [{ userId: 7, menuId: 101 }, { userId: 7, menuId: 102 }],
    });
  });

  it('2. 复制角色操作到用户（写入 operationId 列表）', async () => {
    mock.sysRoleMenu.findMany.mockResolvedValue([] as any);
    // 角色 3 的操作 [201, 202]
    mock.sysRoleOperation.findMany.mockResolvedValue([{ operationId: 201 }, { operationId: 202 }] as any);

    const r: any = await service.applyRoleTemplate(7, 3);
    expect(r.menuCount).toBe(0);
    expect(r.operationCount).toBe(2);

    expect(mock.sysUserOperation.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(mock.sysUserOperation.createMany).toHaveBeenCalledWith({
      data: [{ userId: 7, operationId: 201 }, { userId: 7, operationId: 202 }],
    });
  });
});
