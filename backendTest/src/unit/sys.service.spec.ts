/**
 * SysService 单元测试（修复版，对照真实方法签名）
 */
import { Test } from '@nestjs/testing';
import { SysService } from '@app/modules/sys/sys.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('SysService', () => {
  let service: SysService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        SysService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<SysService>(SysService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. listDict 全部', async () => {
    setMock(mock, 'sysDict.findMany', [{ id: 1, type: 'A', label: 'a' }]);
    const r: any = await service.listDict();
    expect(r.length).toBe(1);
    expect(mock.sysDict.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('2. listDict 按 type 过滤', async () => {
    setMock(mock, 'sysDict.findMany', []);
    await service.listDict('category');
    expect(mock.sysDict.findMany.mock.calls[0][0].where).toEqual({ type: 'category' });
  });

  it('3. listDictByTypes 按 type 分组', async () => {
    setMock(mock, 'sysDict.findMany', [
      { id: 1, type: 'A', label: 'a1' },
      { id: 2, type: 'B', label: 'b1' },
      { id: 3, type: 'A', label: 'a2' },
    ]);
    const r: any = await service.listDictByTypes(['A', 'B']);
    expect(r.A.length).toBe(2);
    expect(r.B.length).toBe(1);
  });

  it('4. getDeptTree 构建嵌套树', async () => {
    setMock(mock, 'sysDept.findMany', [
      { id: 1, parentId: null, name: '总' },
      { id: 2, parentId: 1, name: '销' },
      { id: 3, parentId: 1, name: '采' },
      { id: 4, parentId: 2, name: '销一' },
    ]);
    const tree: any = await service.getDeptTree();
    expect(tree.length).toBe(1);
    expect(tree[0].children.length).toBe(2);
    expect(tree[0].children[0].children.length).toBe(1);
  });

  it('5. createDept / updateDept / deleteDept', async () => {
    setMock(mock, 'sysDept.create', { id: 99 });
    await service.createDept({ name: '新部门', parentId: 1 });
    setMock(mock, 'sysDept.update', { id: 1 });
    await service.updateDept(1, { name: '改' });
    setMock(mock, 'sysDept.delete', { id: 1 });
    await service.deleteDept(1);
    expect(mock.sysDept.create).toHaveBeenCalled();
    expect(mock.sysDept.update).toHaveBeenCalled();
    expect(mock.sysDept.delete).toHaveBeenCalled();
  });

  it('6. listAllMenus 全部', async () => {
    setMock(mock, 'sysMenu.findMany', [{ id: 1, name: '客户' }]);
    const r: any = await service.listAllMenus();
    expect(r.length).toBe(1);
  });

  it('7. listMenusForUser (admin) returns full tree with all=true', async () => {
    setMock(mock, 'sysMenu.findMany', [{ id: 1, name: '客户', parentId: null }]);
    const r: any = await service.listMenusForUser({ id: 1, isAdmin: true });
    expect(r.all).toBe(true);
    expect(Array.isArray(r.tree)).toBe(true);
  });

  it('8. listOperations', async () => {
    setMock(mock, 'sysOperation.findMany', [{ id: 1, code: 'crm:customer:list' }]);
    const r: any = await service.listOperations();
    expect(r.length).toBe(1);
  });

  it('9. createOperation', async () => {
    setMock(mock, 'sysOperation.create', { id: 99 });
    await service.createOperation({ code: 'crm:customer:export', name: '导出客户' });
    expect(mock.sysOperation.create).toHaveBeenCalled();
  });

  it('10. listRoles includes computed menuIds + operationCodes', async () => {
    setMock(mock, 'sysRole.findMany', [
      {
        id: 1, code: 'admin',
        menus: [{ menuId: 22 }],
        operations: [{ operation: { code: 'crm:customer:list' } }],
      },
    ]);
    const r: any = await service.listRoles();
    expect(r.length).toBe(1);
    expect(r[0].menuIds).toEqual([22]);
    expect(r[0].operationCodes).toEqual(['crm:customer:list']);
  });

  it('11. createRole with operations & menus', async () => {
    setMock(mock, 'sysRole.create', { id: 99 });
    await service.createRole({
      code: 'sales', name: '销售', dataScope: 4,
      operationCodes: ['crm:customer:list'], menuIds: [22, 23],
    });
    const call = mock.sysRole.create.mock.calls[0][0];
    expect(call.data.operations).toBeDefined();
    expect(call.data.menus).toBeDefined();
  });

  it('12. getRoleMenuIds', async () => {
    setMock(mock, 'sysRoleMenu.findMany', [{ menuId: 22 }, { menuId: 23 }]);
    const ids = await service.getRoleMenuIds(2);
    expect(ids.sort()).toEqual([22, 23]);
  });

  it('13. getRoleOperationCodes', async () => {
    setMock(mock, 'sysRoleOperation.findMany', [
      { operation: { code: 'crm:customer:list' } },
      { operation: { code: 'crm:customer:create' } },
    ]);
    const codes = await service.getRoleOperationCodes(2);
    expect(codes.sort()).toEqual(['crm:customer:create', 'crm:customer:list']);
  });

  it('14. listUsers returns only basic fields (no roleCodes)', async () => {
    setMock(mock, 'sysUser.findMany', [
      { id: 1, username: 'admin', name: '超管', deptId: 1, isActive: true },
    ]);
    const r: any = await service.listUsers();
    expect(r[0].username).toBe('admin');
    // listUsers 仅 select 基础字段，不返回 roleCodes
    expect(r[0].roleCodes).toBeUndefined();
  });

  it('15. listUsersPage paginates', async () => {
    setMock(mock, '$transaction', [10, [{ id: 1 }]]);
    const r: any = await service.listUsersPage({ page: 1, pageSize: 10 });
    expect(r.total).toBe(10);
  });

  it('16. createUser with default password and roleIds → connect', async () => {
    setMock(mock, 'sysUser.create', { id: 99 });
    await service.createUser({
      username: 'newuser', name: '新人', password: '123456', roleIds: [2], deptId: 1,
    });
    const call = mock.sysUser.create.mock.calls[0][0];
    expect(call.data.roles).toEqual({ create: [{ roleId: 2 }] });
  });

  it('17. updateUser with empty password keeps old password', async () => {
    setMock(mock, 'sysUser.update', { id:1, password:'OLD' });
    await service.updateUser(1, { name: '改', password: '' });
    const call = mock.sysUser.update.mock.calls[0][0];
    // 空密码 → 不更新 password 字段
    expect(call.data.password).toBeUndefined();
  });

  it('18. changeUserPassword rejects wrong old password', async () => {
    setMock(mock, 'sysUser.findUnique', { id: 2, password: 'CORRECT' });
    await expect(service.changeUserPassword(1, 2, 'WRONG', 'NEW')).rejects.toThrow();
  });

  it('19. changeUserPassword updates when old matches', async () => {
    setMock(mock, 'sysUser.findUnique', { id: 2, password: 'OLD' });
    setMock(mock, 'sysUser.update', { id: 2 });
    // 新密码需 >= 6 位；改他人密码强制 mustResetPassword=true
    await service.changeUserPassword(1, 2, 'OLD', 'NEW123');
    const call = mock.sysUser.update.mock.calls[0][0];
    expect(call.data.password).toBe('NEW123');
    expect(call.data.mustResetPassword).toBe(true);
  });

  it('20. deleteUser removes user when no business association', async () => {
    // deleteUser 内先 $transaction 跑 7 个 count 校验，全 0 才物理删除
    setMock(mock, '$transaction', [0, 0, 0, 0, 0, 0, 0]);
    setMock(mock, 'sysUser.delete', { id: 1 });
    await service.deleteUser(1);
    expect(mock.sysUser.delete).toHaveBeenCalled();
  });

  it('21. getUserMenuIds: SysUserMenu 优先 + 并集 SysRoleMenu', async () => {
    setMock(mock, 'sysUserMenu.findMany', [{ menuId: 30 }]);
    setMock(mock, 'sysUser.findUnique', { id: 1, roles: [{ roleId: 2 }] });
    setMock(mock, 'sysRoleMenu.findMany', [{ menuId: 22 }, { menuId: 23 }]);
    const ids = await service.getUserMenuIds(1);
    expect(ids.sort()).toEqual([22, 23, 30]);
  });

  it('22. getUserOperationCodes returns only direct user grants (no role merge)', async () => {
    // 有直接授权时只返回直接授权，不与角色授权合并
    setMock(mock, 'sysUserOperation.findMany', [{ operation: { code: 'u:crm:export', isActive: true } }]);
    const codes = await service.getUserOperationCodes(1);
    expect(codes).toEqual(['u:crm:export']);
  });

  it('22b. getUserOperationCodes falls back to role ops when no direct grant', async () => {
    setMock(mock, 'sysUserOperation.findMany', []);
    setMock(mock, 'sysUser.findUnique', { id: 1, roles: [{ roleId: 2 }] });
    setMock(mock, 'sysRoleOperation.findMany', [{ operation: { code: 'r:crm:list', isActive: true } }]);
    const codes = await service.getUserOperationCodes(1);
    expect(codes).toEqual(['r:crm:list']);
  });

  it('23. listRegionTree', async () => {
    setMock(mock, 'sysRegion.findMany', [
      { id: 1, level: 1, parentId: null, name: '北京' },
      { id: 2, level: 2, parentId: 1, name: '朝阳区' },
    ]);
    const tree: any = await service.listRegionTree();
    expect(tree.length).toBe(1);
    expect(tree[0].children.length).toBe(1);
  });

  it('24. getCompany creates if missing', async () => {
    setMock(mock, 'sysCompany.findFirst', null);
    setMock(mock, 'sysCompany.create', { id: 1, name: '陕西飞创腾达' });
    const c: any = await service.getCompany();
    expect(c.id).toBe(1);
  });

  it('25. saveCompany updates existing', async () => {
    setMock(mock, 'sysCompany.findFirst', { id: 1, name: 'OLD' });
    setMock(mock, 'sysCompany.update', { id: 1, name: 'NEW' });
    const c: any = await service.saveCompany({ name: 'NEW' });
    expect(c.name).toBe('NEW');
  });
});
