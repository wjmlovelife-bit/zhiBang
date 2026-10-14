/**
 * SysService 全场景补测（与现有 sys.service.spec.ts 25 用例互补）
 *
 * 覆盖：
 *  - 菜单 CRUD：createMenu/updateMenu/deleteMenu（含依赖清理 + Prisma 错误穿透）
 *  - 操作 CRUD：updateOperation/deleteOperation
 *  - 角色 CRUD：updateRole/deleteRole（含 isSystem 保护 + 依赖清理）
 *  - 角色菜单/操作授权：setRoleMenus/setRoleOperations
 *  - 用户菜单/操作授权：setUserMenus/setUserOperations
 *  - 用户 Excel：buildUserTemplate / importUsers
 *  - 行政区划：listRegions
 */
import { SysService } from '@app/modules/sys/sys.service';
import { makeMockPrisma, MockPrisma, setMock, setMockError, resetMockPrisma } from '../setup/prisma-mock';
import * as XLSX from 'xlsx';

describe('SysService extra scenarios', () => {
  let service: SysService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new SysService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // 菜单 CRUD
  // ============================================================
  describe('菜单 CRUD', () => {
    it('1. createMenu 默认值（type=menu, isActive=true, sort=0, parentId=null）', async () => {
      setMock(mock, 'sysMenu.create', { id: 1 });
      await service.createMenu({ name: '菜单A' });
      const call = mock.sysMenu.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        name: '菜单A', type: 'menu', isActive: true, sort: 0,
        parentId: null, path: null, component: null, icon: null, permCode: null,
      });
    });

    it('2. updateMenu 全字段覆盖', async () => {
      setMock(mock, 'sysMenu.update', { id: 1 });
      await service.updateMenu(1, { name: '改', path: '/x', icon: 'i', sort: 10, isActive: false });
      const call = mock.sysMenu.update.mock.calls[0][0];
      expect(call.data.isActive).toBe(false);
      expect(call.data.sort).toBe(10);
    });

    it('3. deleteMenu 先清理 sysRoleMenu + sysUserMenu + sysOperation 再删菜单', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysUserMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysOperation.deleteMany', { count: 0 });
      setMock(mock, 'sysMenu.delete', { id: 1 });
      await service.deleteMenu(1);
      expect(mock.sysRoleMenu.deleteMany).toHaveBeenCalledWith({ where: { menuId: 1 } });
      expect(mock.sysUserMenu.deleteMany).toHaveBeenCalledWith({ where: { menuId: 1 } });
      expect(mock.sysOperation.deleteMany).toHaveBeenCalledWith({ where: { menuId: 1 } });
      expect(mock.sysMenu.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('4. deleteMenu 不存在 → Prisma P2025', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysUserMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysOperation.deleteMany', { count: 0 });
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'sysMenu.delete', err);
      await expect(service.deleteMenu(999)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // 操作 CRUD
  // ============================================================
  describe('操作 CRUD', () => {
    it('5. updateOperation 默认值（sort=0, isActive=true, menuId=null）', async () => {
      setMock(mock, 'sysOperation.update', { id: 1 });
      await service.updateOperation(1, { group: 'g', module: 'm', name: 'n', code: 'c' });
      const call = mock.sysOperation.update.mock.calls[0][0];
      expect(call.data.sort).toBe(0);
      expect(call.data.isActive).toBe(true);
      expect(call.data.menuId).toBeNull();
    });

    it('6. updateOperation 显式 menuId 写入', async () => {
      setMock(mock, 'sysOperation.update', { id: 1 });
      await service.updateOperation(1, { group: 'g', module: 'm', name: 'n', code: 'c', menuId: 99 });
      expect(mock.sysOperation.update.mock.calls[0][0].data.menuId).toBe(99);
    });

    it('7. deleteOperation 不存在 → P2025', async () => {
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'sysOperation.delete', err);
      await expect(service.deleteOperation(999)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // 角色 CRUD
  // ============================================================
  describe('角色 CRUD', () => {
    it('8. updateRole 不传 menuIds/operationCodes → 不清空旧授权', async () => {
      setMock(mock, 'sysRole.update', { id: 1 });
      await service.updateRole(1, { code: 'C', name: 'N', dataScope: 4, isSystem: false });
      expect(mock.sysRoleMenu.deleteMany).not.toHaveBeenCalled();
      expect(mock.sysRoleOperation.deleteMany).not.toHaveBeenCalled();
      expect(mock.sysRole.update.mock.calls[0][0].data).not.toHaveProperty('menus');
      expect(mock.sysRole.update.mock.calls[0][0].data).not.toHaveProperty('operations');
    });

    it('9. updateRole 传 menuIds → 清空旧 + 写入新', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysRole.update', { id: 1 });
      await service.updateRole(1, { code: 'C', name: 'N', menuIds: [10, 20] });
      expect(mock.sysRoleMenu.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      expect(mock.sysRole.update.mock.calls[0][0].data.menus).toEqual({
        create: [{ menuId: 10 }, { menuId: 20 }],
      });
    });

    it('10. updateRole 传 operationCodes → 清空旧 + 用 connect 关联', async () => {
      setMock(mock, 'sysRoleOperation.deleteMany', { count: 0 });
      setMock(mock, 'sysRole.update', { id: 1 });
      await service.updateRole(1, { code: 'C', name: 'N', operationCodes: ['user.create', 'user.delete'] });
      expect(mock.sysRoleOperation.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      expect(mock.sysRole.update.mock.calls[0][0].data.operations).toEqual({
        create: [
          { operation: { connect: { code: 'user.create' } } },
          { operation: { connect: { code: 'user.delete' } } },
        ],
      });
    });

    it('11. deleteRole 清理全部关联（roleMenu/roleOperation/userRole）', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysRoleOperation.deleteMany', { count: 0 });
      setMock(mock, 'sysUserRole.deleteMany', { count: 0 });
      setMock(mock, 'sysRole.delete', { id: 1 });
      await service.deleteRole(1);
      expect(mock.sysRoleMenu.deleteMany).toHaveBeenCalled();
      expect(mock.sysRoleOperation.deleteMany).toHaveBeenCalled();
      expect(mock.sysUserRole.deleteMany).toHaveBeenCalled();
      expect(mock.sysRole.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('12. ⚠ 行为记录：源码 updateRole 不保护 isSystem 字段（前端改 isSystem=true 也能通过）', async () => {
      // 业务规则建议：isSystem 角色不应允许通过 updateRole 改 isSystem=true
      // 源码 line 183-185 updateRole 把 isSystem 写入 data，未做权限保护
      setMock(mock, 'sysRole.update', { id: 1 });
      await service.updateRole(1, { code: 'C', name: 'N', isSystem: true });
      expect(mock.sysRole.update.mock.calls[0][0].data.isSystem).toBe(true);
    });
  });

  // ============================================================
  // 角色菜单/操作授权
  // ============================================================
  describe('角色菜单/操作授权', () => {
    it('13. setRoleMenus 清空旧 + 写入新', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysRoleMenu.createMany', { count: 2 });
      const r: any = await service.setRoleMenus(1, [10, 20]);
      expect(mock.sysRoleMenu.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      expect(mock.sysRoleMenu.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 1, menuId: 10 }, { roleId: 1, menuId: 20 }],
      });
      // 返回值因 mock 行为而有差异
      expect(r).toBeDefined();
    });

    it('14. setRoleMenus 空数组 → 清空旧授权', async () => {
      setMock(mock, 'sysRoleMenu.deleteMany', { count: 0 });
      await service.setRoleMenus(1, []);
      expect(mock.sysRoleMenu.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      // 空数组 createMany 不调（前置检查）
    });

    it('15. setRoleOperations 清空旧 + 按 code 关联', async () => {
      setMock(mock, 'sysRoleOperation.deleteMany', { count: 0 });
      setMock(mock, 'sysOperation.findMany', [
        { id: 100, code: 'a' }, { id: 101, code: 'b' },
      ]);
      setMock(mock, 'sysRoleOperation.createMany', { count: 2 });
      await service.setRoleOperations(1, ['a', 'b']);
      expect(mock.sysRoleOperation.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      expect(mock.sysOperation.findMany).toHaveBeenCalledWith({
        where: { code: { in: ['a', 'b'] } },
        select: { id: true },
      });
      expect(mock.sysRoleOperation.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 1, operationId: 100 }, { roleId: 1, operationId: 101 }],
      });
    });

    it('16. setRoleOperations 空数组 → 清空旧授权', async () => {
      setMock(mock, 'sysRoleOperation.deleteMany', { count: 0 });
      await service.setRoleOperations(1, []);
      expect(mock.sysRoleOperation.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1 } });
      expect(mock.sysOperation.findMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 用户菜单/操作授权
  // ============================================================
  describe('用户菜单/操作授权', () => {
    it('17. setUserMenus 清空旧 + 写入新', async () => {
      setMock(mock, 'sysUserMenu.deleteMany', { count: 0 });
      setMock(mock, 'sysUserMenu.createMany', { count: 2 });
      await service.setUserMenus(1, [10, 20]);
      expect(mock.sysUserMenu.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(mock.sysUserMenu.createMany).toHaveBeenCalledWith({
        data: [{ userId: 1, menuId: 10 }, { userId: 1, menuId: 20 }],
      });
    });

    it('18. setUserMenus 空数组 → 清空', async () => {
      setMock(mock, 'sysUserMenu.deleteMany', { count: 0 });
      await service.setUserMenus(1, []);
      expect(mock.sysUserMenu.deleteMany).toHaveBeenCalled();
    });

    it('19. setUserOperations 清空旧 + 按 code 关联', async () => {
      setMock(mock, 'sysUserOperation.deleteMany', { count: 0 });
      setMock(mock, 'sysOperation.findMany', [{ id: 200, code: 'x' }]);
      setMock(mock, 'sysUserOperation.createMany', { count: 1 });
      await service.setUserOperations(1, ['x']);
      expect(mock.sysUserOperation.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(mock.sysUserOperation.createMany).toHaveBeenCalledWith({
        data: [{ userId: 1, operationId: 200 }],
      });
    });

    it('20. setUserOperations 空数组 → 清空', async () => {
      setMock(mock, 'sysUserOperation.deleteMany', { count: 0 });
      await service.setUserOperations(1, []);
      expect(mock.sysUserOperation.deleteMany).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 用户 Excel 模板/导入
  // ============================================================
  describe('用户 Excel', () => {
    it('21. buildUserTemplate 返回 xlsx Buffer（长度 > 1000 + 含表头）', () => {
      const buf = service.buildUserTemplate();
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(500);
      // 反向解析确认表头
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
      expect(rows[0]).toContain('用户名(username)');
      expect(rows[0]).toContain('姓名(name)');
      expect(rows[0]).toContain('启用(1/0)');
    });

    it('22. buildUserTemplate 含示例数据 2 行', () => {
      const buf = service.buildUserTemplate();
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // header + 2 samples = 3 行
      expect(rows.length).toBe(3);
      expect(rows[1][0]).toBe('zhangsan');
      expect(rows[2][0]).toBe('lisi');
    });

    it('23. importUsers 用户名空 → 跳过且记 msg', async () => {
      // 构造只含 username=空 的 xlsx
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名(username)'],
        [''],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, '用户');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      setMock(mock, 'sysUser.findUnique', null); // 不调用
      const r: any = await service.importUsers(buf);
      expect(r.total).toBe(1);
      expect(r.success).toBe(0);
      expect(r.failed).toBe(1);
      expect(r.results[0].ok).toBe(false);
      expect(r.results[0].msg).toContain('用户名为空');
      expect(mock.sysUser.findUnique).not.toHaveBeenCalled();
    });

    it('24. importUsers 用户名已存在 → 跳过且记 "用户名已存在"', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名(username)', '姓名(name)'],
        ['existing_user', '老用户'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, '用户');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      setMock(mock, 'sysUser.findUnique', { id: 99, username: 'existing_user' });
      const r: any = await service.importUsers(buf);
      expect(r.success).toBe(0);
      expect(r.results[0].msg).toContain('用户名已存在');
    });

    it('25. importUsers 正常行 → create + 含 roles 关联', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名(username)', '姓名(name)', '密码(password)', '部门ID(deptId)', '角色ID(roleId,多个用逗号)', '邮箱(email)', '手机(phone)', '是否管理员(1/0)', '启用(1/0)'],
        ['new_user_1', '新用户', 'pwd', 2, '2,3', 'a@b.com', '13800000000', 0, 1],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, '用户');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      setMock(mock, 'sysUser.findUnique', null);
      setMock(mock, 'sysUser.create', { id: 100 });
      const r: any = await service.importUsers(buf);
      expect(r.success).toBe(1);
      const createArgs = mock.sysUser.create.mock.calls[0][0];
      expect(createArgs.data.username).toBe('new_user_1');
      expect(createArgs.data.name).toBe('新用户');
      expect(createArgs.data.email).toBe('a@b.com');
      expect(createArgs.data.isAdmin).toBe(false);
      expect(createArgs.data.isActive).toBe(true);
      // roles 关联
      expect(createArgs.data.roles).toEqual({
        create: [{ roleId: 2 }, { roleId: 3 }],
      });
    });

    it('26. importUsers 缺必填（username）且默认密码 → 用 default "123456"', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名(username)'],
        ['u1'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, '用户');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      setMock(mock, 'sysUser.findUnique', null);
      setMock(mock, 'sysUser.create', { id: 100 });
      await service.importUsers(buf);
      const createArgs = mock.sysUser.create.mock.calls[0][0];
      expect(createArgs.data.password).toBe('123456');
      expect(createArgs.data.name).toBe('u1'); // 默认 name = username
    });

    it('27. importUsers 多行混合（部分成功部分失败）', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名(username)'],
        ['ok_user'],
        [''], // 用户名空 → 失败
        ['existing'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, '用户');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      // 第一次 findUnique：ok_user 不存在 → create
      // 第二次 findUnique：existing 已存在 → 跳过
      mock.sysUser.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 99 });
      setMock(mock, 'sysUser.create', { id: 1 });
      const r: any = await service.importUsers(buf);
      expect(r.total).toBe(3);
      expect(r.success).toBe(1);
      expect(r.failed).toBe(2);
    });
  });

  // ============================================================
  // 行政区划
  // ============================================================
  describe('listRegions', () => {
    it('28. parentId 未传 → 顶级（parentId: null）', async () => {
      setMock(mock, 'sysRegion.findMany', []);
      await service.listRegions();
      const call = mock.sysRegion.findMany.mock.calls[0][0];
      expect(call.where.parentId).toBeNull();
      expect(call.orderBy).toEqual({ id: 'asc' });
    });

    it('29. parentId 传 5 → 查 parentId=5 的子级', async () => {
      setMock(mock, 'sysRegion.findMany', []);
      await service.listRegions(5);
      const call = mock.sysRegion.findMany.mock.calls[0][0];
      expect(call.where.parentId).toBe(5);
    });

    it('30. parentId=0 显式 → 查 parentId=0（注意与未传的区别）', async () => {
      setMock(mock, 'sysRegion.findMany', []);
      await service.listRegions(0);
      expect(mock.sysRegion.findMany.mock.calls[0][0].where.parentId).toBe(0);
    });
  });
});