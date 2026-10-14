import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCacheService } from '../../common/token-cache.service';

@Injectable()
export class SysService {
  constructor(
    private prisma: PrismaService,
    private tokenCache: TokenCacheService,
    @InjectPinoLogger(SysService.name) private readonly logger: PinoLogger,
  ) {}

  // ============ 字典 ============
  async listDict(type?: string) {
    const where = type ? { type } : {};
    return this.prisma.sysDict.findMany({ where, orderBy: { sort: 'asc' } });
  }

  async listDictByTypes(types: string[]) {
    const list = await this.prisma.sysDict.findMany({ where: { type: { in: types } }, orderBy: { sort: 'asc' } });
    const map: Record<string, any[]> = {};
    for (const d of list) (map[d.type] ||= []).push(d);
    return map;
  }

  // ============ 部门 ============
  async listDepts() {
    return this.prisma.sysDept.findMany({ orderBy: { sort: 'asc' } });
  }

  async getDeptTree() {
    const all = await this.prisma.sysDept.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    const map = new Map<number, any>();
    all.forEach((d) => map.set(d.id, { value: d.id, label: d.name, id: d.id, parentId: d.parentId, children: [] as any[] }));
    const roots: any[] = [];
    map.forEach((n) => {
      const p = n.parentId ? map.get(n.parentId) : null;
      if (p) p.children.push(n);
      else roots.push(n);
    });
    return roots;
  }

  async createDept(dto: any) {
    return this.prisma.sysDept.create({ data: { name: dto.name, parentId: dto.parentId ?? null, sort: dto.sort ?? 0 } });
  }

  async updateDept(id: number, dto: any) {
    return this.prisma.sysDept.update({ where: { id }, data: { name: dto.name, parentId: dto.parentId ?? null, sort: dto.sort ?? 0 } });
  }

  async deleteDept(id: number) {
    return this.prisma.sysDept.delete({ where: { id } });
  }

  // ============ 菜单 ============
  // 全部菜单（扁平，含 parentId），供分配界面构造树
  async listAllMenus() {
    return this.prisma.sysMenu.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
  }

  // 用户可见菜单（最终授权 = 用户级 SysUserMenu；若无则回退角色级 SysRoleMenu）
  async listMenusForUser(user: any) {
    if (user?.isAdmin) {
      const all = await this.prisma.sysMenu.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
      return { tree: this.buildMenuTree(all), fallback: false, all: true };
    }
    // 角色菜单 ∪ 个性化菜单（并集）—— 已由 getUserMenuIds 处理
    const ids = await this.getUserMenuIds(user.id);
    const fallback = false;
    let menus = await this.prisma.sysMenu.findMany({ where: { id: { in: ids } } });
    // 自动补全缺失的父级菜单（保证树形结构完整）
    // R33 优化：用 PG 递归 CTE 一次查出所有缺失的祖先，避免 N+1 findUnique
    if (menus.length) {
      const ownIds = menus.map((m: any) => m.id);
      const missing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `WITH RECURSIVE ancestors AS (
           SELECT "parentId" AS id FROM "SysMenu"
             WHERE id = ANY($1::int[]) AND "parentId" IS NOT NULL
           UNION
           SELECT m."parentId" FROM "SysMenu" m
             INNER JOIN ancestors a ON m.id = a.id
             WHERE m."parentId" IS NOT NULL
         )
         SELECT DISTINCT id FROM ancestors
           WHERE id <> ALL($1::int[])`,
        ownIds,
      );
      const missingIds = (missing as Array<{ id: number }>).map((r) => r.id);
      if (missingIds.length) {
        const parents = await this.prisma.sysMenu.findMany({ where: { id: { in: missingIds } } });
        menus = [...menus, ...parents];
      }
    }
    return { tree: this.buildMenuTree(menus), fallback };
  }

  private buildMenuTree(menus: any[]) {
    const map = new Map<number, any>();
    menus.forEach((m) => map.set(m.id, { ...m, children: [] }));
    const roots: any[] = [];
    map.forEach((m) => {
      if (m.parentId && map.has(m.parentId)) map.get(m.parentId).children.push(m);
      else roots.push(m);
    });
    return roots;
  }

  // ============ 菜单增删改 ============
  async createMenu(dto: any) {
    return this.prisma.sysMenu.create({
      data: {
        name: dto.name,
        path: dto.path || null,
        type: dto.type || 'menu',
        parentId: dto.parentId ?? null,
        component: dto.component || null,
        icon: dto.icon || null,
        permCode: dto.permCode || null,
        sort: dto.sort ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMenu(id: number, dto: any) {
    return this.prisma.sysMenu.update({
      where: { id },
      data: {
        name: dto.name,
        path: dto.path || null,
        type: dto.type || 'menu',
        parentId: dto.parentId ?? null,
        component: dto.component || null,
        icon: dto.icon || null,
        permCode: dto.permCode || null,
        sort: dto.sort ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async deleteMenu(id: number) {
    // 同步清理：角色/用户菜单授权 + 该菜单挂载的操作权限，避免删除菜单后残留孤儿权限码
    await this.prisma.sysRoleMenu.deleteMany({ where: { menuId: id } });
    await this.prisma.sysUserMenu.deleteMany({ where: { menuId: id } });
    await this.prisma.sysOperation.deleteMany({ where: { menuId: id } });
    return this.prisma.sysMenu.delete({ where: { id } });
  }

  // ============ 操作权限目录（SysOperation 目录表） ============
  async listOperations() {
    return this.prisma.sysOperation.findMany({ orderBy: [{ group: 'asc' }, { sort: 'asc' }, { id: 'asc' }] });
  }

  async createOperation(dto: any) {
    return this.prisma.sysOperation.create({
      data: { group: dto.group, module: dto.module, name: dto.name, code: dto.code, sort: dto.sort ?? 0, isActive: dto.isActive ?? true, menuId: dto.menuId ?? null },
    });
  }

  async updateOperation(id: number, dto: any) {
    return this.prisma.sysOperation.update({ where: { id }, data: { group: dto.group, module: dto.module, name: dto.name, code: dto.code, sort: dto.sort ?? 0, isActive: dto.isActive ?? true, menuId: dto.menuId ?? null } });
  }

  async deleteOperation(id: number) {
    return this.prisma.sysOperation.delete({ where: { id } });
  }

  // ============ 角色 ============
  async listRoles() {
    const roles = await this.prisma.sysRole.findMany({ orderBy: { id: 'asc' }, include: { menus: { include: { menu: true } }, operations: { include: { operation: true } } } });
    return roles.map((r) => ({
      ...r,
      menuIds: r.menus.map((m: any) => m.menuId),
      operationCodes: r.operations.map((o: any) => o.operation?.code).filter(Boolean),
    }));
  }

  async createRole(dto: any) {
    const { menuIds, operationCodes, ...rest } = dto;
    return this.prisma.sysRole.create({
      data: {
        code: rest.code,
        name: rest.name,
        dataScope: rest.dataScope ?? 4,
        isSystem: rest.isSystem ?? false,
        menus: menuIds?.length ? { create: menuIds.map((menuId: number) => ({ menuId })) } : undefined,
        operations: operationCodes?.length ? { create: operationCodes.map((code: string) => ({ operation: { connect: { code } } })) } : undefined,
      },
    });
  }

  async updateRole(id: number, dto: any) {
    const { menuIds, operationCodes, ...rest } = dto;
    const data: any = { code: rest.code, name: rest.name, dataScope: rest.dataScope ?? 4, isSystem: rest.isSystem ?? false };
    if (menuIds) {
      await this.prisma.sysRoleMenu.deleteMany({ where: { roleId: id } });
      data.menus = { create: menuIds.map((menuId: number) => ({ menuId })) };
    }
    if (operationCodes) {
      await this.prisma.sysRoleOperation.deleteMany({ where: { roleId: id } });
      data.operations = { create: operationCodes.map((code: string) => ({ operation: { connect: { code } } })) };
    }
    return this.prisma.sysRole.update({ where: { id }, data });
  }

  async deleteRole(id: number) {
    await this.prisma.sysRoleMenu.deleteMany({ where: { roleId: id } });
    await this.prisma.sysRoleOperation.deleteMany({ where: { roleId: id } });
    await this.prisma.sysUserRole.deleteMany({ where: { roleId: id } });
    return this.prisma.sysRole.delete({ where: { id } });
  }

  // 角色 → 菜单（直接读取）
  async getRoleMenuIds(id: number) {
    const rows = await this.prisma.sysRoleMenu.findMany({ where: { roleId: id }, select: { menuId: true } });
    return rows.map((r: any) => r.menuId);
  }

  async setRoleMenus(id: number, menuIds: number[]) {
    await this.prisma.sysRoleMenu.deleteMany({ where: { roleId: id } });
    if (menuIds?.length) await this.prisma.sysRoleMenu.createMany({ data: menuIds.map((menuId: number) => ({ roleId: id, menuId })) });
    return { count: menuIds?.length || 0 };
  }

  async getRoleOperationCodes(id: number) {
    const rows = await this.prisma.sysRoleOperation.findMany({ where: { roleId: id }, include: { operation: { select: { code: true } } } });
    return rows.map((r: any) => r.operation?.code).filter(Boolean);
  }

  async setRoleOperations(id: number, codes: string[]) {
    await this.prisma.sysRoleOperation.deleteMany({ where: { roleId: id } });
    if (codes?.length) {
      const ops = await this.prisma.sysOperation.findMany({ where: { code: { in: codes } }, select: { id: true } });
      await this.prisma.sysRoleOperation.createMany({ data: ops.map((o: any) => ({ roleId: id, operationId: o.id })) });
    }
    return { count: codes?.length || 0 };
  }

  // ============ 用户 ============
  async listUsersPage(q: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 1000);
    const where: any = {};
    if (q.keyword) where.OR = [{ name: { contains: q.keyword } }, { username: { contains: q.keyword } }];
    if (q.deptId) where.deptId = Number(q.deptId);
    if (q.roleId) where.roles = { some: { roleId: Number(q.roleId) } };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.sysUser.count({ where }),
      this.prisma.sysUser.findMany({
        where,
        include: { dept: { select: { id: true, name: true } }, roles: { include: { role: { select: { id: true, name: true, code: true } } } } },
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted'});
    return { total, items, page, pageSize };
  }

  async createUser(dto: any) {
    const { roleIds = [], menuIds = [], operationCodes = [], ...rest } = dto;
    const data: any = {
      username: rest.username,
      name: rest.name,
      password: rest.password || '123456',
      deptId: rest.deptId ?? null,
      isAdmin: rest.isAdmin ?? false,
      isActive: rest.isActive ?? true,
      email: rest.email,
      phone: rest.phone,
      remark: rest.remark,
      roles: roleIds.length ? { create: roleIds.map((roleId: number) => ({ roleId })) } : undefined,
      userMenus: menuIds.length ? { create: menuIds.map((menuId: number) => ({ menuId })) } : undefined,
      userOperations: operationCodes.length ? { create: operationCodes.map((code: string) => ({ operation: { connect: { code } } })) } : undefined,
    };
    this.logger.info({ username: data.username, roleCount: roleIds.length, menuCount: menuIds.length }, 'createUser start');
    const user = await this.prisma.sysUser.create({ data, include: { roles: { include: { role: true } }, userMenus: true, userOperations: true } });
    this.logger.info({ userId: user.id, username: user.username }, 'createUser done');
    return user;
  }

  async updateUser(id: number, dto: any) {
    this.logger.info({ targetUserId: id }, 'updateUser start');
    const { roleIds, menuIds, operationCodes, ...rest } = dto;
    const data: any = {
      name: rest.name,
      deptId: rest.deptId ?? null,
      isAdmin: rest.isAdmin ?? false,
      isActive: rest.isActive ?? true,
      email: rest.email,
      phone: rest.phone,
      remark: rest.remark,
    };
    if (rest.password) data.password = rest.password;
    if (roleIds !== undefined) {
      await this.prisma.sysUserRole.deleteMany({ where: { userId: id } });
      data.roles = { create: roleIds.map((roleId: number) => ({ roleId })) };
    }
    if (menuIds !== undefined) {
      await this.prisma.sysUserMenu.deleteMany({ where: { userId: id } });
      data.userMenus = { create: menuIds.map((menuId: number) => ({ menuId })) };
    }
    if (operationCodes !== undefined) {
      await this.prisma.sysUserOperation.deleteMany({ where: { userId: id } });
      if (operationCodes.length) {
        const ops = await this.prisma.sysOperation.findMany({ where: { code: { in: operationCodes } }, select: { id: true } });
        data.userOperations = { create: ops.map((o: any) => ({ operationId: o.id })) };
      }
    }
    // R32 方案C：密码/角色/菜单/操作/isActive 任意一项变更 → tokenVersion++ → 旧 JWT 立即失效
    data.tokenVersion = { increment: 1 };
    const result = await this.prisma.sysUser.update({ where: { id }, data, include: { roles: { include: { role: true } }, userMenus: true, userOperations: true } });
    this.tokenCache.invalidate(id); // 立即失效缓存（避免 5s 内 cache hit 旧 tv）
    this.logger.info({ targetUserId: id, hasPassword: !!rest.password, roleCount: roleIds?.length || 0, menuCount: menuIds?.length || 0 }, 'updateUser done');
    return result;
  }

  // 应用角色模板：把角色的菜单/操作复制为该用户的直接授权
  async applyRoleTemplate(userId: number, roleId: number) {
    const [menus, ops] = await Promise.all([
      this.prisma.sysRoleMenu.findMany({ where: { roleId }, select: { menuId: true } }),
      this.prisma.sysRoleOperation.findMany({ where: { roleId }, select: { operationId: true } }),
    ]);
    await this.prisma.$transaction([
      this.prisma.sysUserMenu.deleteMany({ where: { userId } }),
      this.prisma.sysUserOperation.deleteMany({ where: { userId } }),
      this.prisma.sysUserMenu.createMany({ data: menus.map((m: any) => ({ userId, menuId: m.menuId })) }),
      this.prisma.sysUserOperation.createMany({ data: ops.map((o: any) => ({ userId, operationId: o.operationId })) }),
      // R32：应用模板也是权限变更，必须 ++tv
      this.prisma.sysUser.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ], { isolationLevel: 'ReadCommitted'});
    this.tokenCache.invalidate(userId);
    return { menuCount: menus.length, operationCount: ops.length };
  }

  async deleteUser(id: number) {
    this.logger.info({ targetUserId: id }, 'deleteUser start');
    // 物理删除前，先检查该用户是否还作为关键关联人挂在业务数据上。
    // 有业务关联 → 禁止删除（避免误删客户/项目/日志等数据）；无关联 → 物理删除，
    // 由 schema 的 onDelete: Cascade 自动清理角色/菜单/操作授权、本周总结、日报、项目共享等。
    const checks = await this.prisma.$transaction([
      this.prisma.crmCustomer.count({ where: { OR: [{ ownerId: id }, { createdById: id }, { updatedById: id }] } }),
      this.prisma.crmOpportunity.count({ where: { OR: [{ ownerId: id }, { createdById: id }] } }),
      this.prisma.crmCustomerFollow.count({ where: { followerId: id } }),
      this.prisma.crmProjectFollow.count({ where: { followerId: id } }),
      this.prisma.crmWorkLog.count({ where: { OR: [{ ownerId: id }, { createdById: id }] } }),
      this.prisma.bizInventory.count({ where: { OR: [{ ownerId: id }, { createdById: id }, { updatedById: id }] } }),
      this.prisma.bizPurchase.count({ where: { OR: [{ ownerId: id }, { createdById: id }, { updatedById: id }] } }),
    ]);
    const total = checks.reduce((a, b) => a + b, 0);
    if (total > 0) {
      this.logger.warn({ targetUserId: id, refs: total }, 'deleteUser blocked: has business refs');
      throw new BadRequestException(
        '该用户已关联业务数据（客户/项目/跟进/日志/库存/采购等），无法直接删除，请先转移或清理相关数据。',
      );
    }
    const result = await this.prisma.sysUser.delete({ where: { id } });
    this.logger.info({ targetUserId: id }, 'deleteUser done');
    return result;
  }

  /**
   * 管理员改任意用户密码（含自己）
   * - adminId / targetUserId 由 controller 从 JWT / 路径参数注入
   * - 校验顺序：长度 → 用户存在 → 原密码匹配 → 写入
   * - admin 改别人：该用户下次登录会被强制走"密码被重置"提示一次（mustResetPassword=true）
   * - admin 改自己：标记也置 true，但前端额外判断 form.id === currentUserId 决定要不要 logout
   * - 不维护 token 黑名单——后端不主动失效旧 token；admin 改自己时由前端清 token + 跳登录
   */
  async changeUserPassword(adminId: number, targetUserId: number, oldPassword: string, newPassword: string) {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('原密码和新密码不能为空');
    }
    if (String(newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于 6 位');
    }
    const target = await this.prisma.sysUser.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('用户不存在');
    if (target.password !== oldPassword) {
      throw new UnauthorizedException('原密码错误');
    }
    await this.prisma.sysUser.update({
      where: { id: targetUserId },
      data: {
        password: String(newPassword),
        mustResetPassword: true,
        // R32 方案C：改密后旧 token 立即失效
        tokenVersion: { increment: 1 },
      },
    });
    this.tokenCache.invalidate(targetUserId);
    return { ok: true, targetUserId, selfChanged: adminId === targetUserId };
  }

  async getUserMenuIds(userId: number) {
    // 角色默认菜单
    const user = await this.prisma.sysUser.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const roleIds = (user?.roles || []).map((r: any) => r.roleId);
    const roleMenus = await this.prisma.sysRoleMenu.findMany({
      where: { roleId: { in: roleIds } },
      select: { menuId: true },
    });
    // 个性化额外菜单
    const direct = await this.prisma.sysUserMenu.findMany({
      where: { userId },
      select: { menuId: true },
    });
    // 合并去重：角色菜单 ∪ 个性化菜单（并集，个性化只做"加法"不做"屏蔽"）
    const set = new Set<number>();
    for (const r of roleMenus) set.add(r.menuId);
    for (const d of direct) set.add(d.menuId);
    return [...set];
  }

  async setUserMenus(userId: number, menuIds: number[]) {
    await this.prisma.sysUserMenu.deleteMany({ where: { userId } });
    if (menuIds?.length) await this.prisma.sysUserMenu.createMany({ data: menuIds.map((menuId: number) => ({ userId, menuId })) });
    // R32：菜单授权变更 → ++tv
    await this.prisma.sysUser.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    this.tokenCache.invalidate(userId);
    return { count: menuIds?.length || 0 };
  }

  async getUserOperationCodes(userId: number) {
    const direct = await this.prisma.sysUserOperation.findMany({ where: { userId }, include: { operation: { select: { code: true } } } });
    if (direct.length) return direct.map((d: any) => d.operation?.code).filter(Boolean);
    const user = await this.prisma.sysUser.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    const roleIds = (user?.roles || []).map((r: any) => r.roleId);
    const ops = await this.prisma.sysRoleOperation.findMany({ where: { roleId: { in: roleIds } }, include: { operation: { select: { code: true } } } });
    return ops.map((o: any) => o.operation?.code).filter(Boolean);
  }

  async setUserOperations(userId: number, codes: string[]) {
    await this.prisma.sysUserOperation.deleteMany({ where: { userId } });
    if (codes?.length) {
      const ops = await this.prisma.sysOperation.findMany({ where: { code: { in: codes } }, select: { id: true } });
      await this.prisma.sysUserOperation.createMany({ data: ops.map((o: any) => ({ userId, operationId: o.id })) });
    }
    // R32：操作授权变更 → ++tv
    await this.prisma.sysUser.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    this.tokenCache.invalidate(userId);
    return { count: codes?.length || 0 };
  }

  // ============ 用户 Excel 导入/模板 ============
  buildUserTemplate(): Buffer {
    const header = [['用户名(username)', '姓名(name)', '密码(password)', '部门ID(deptId)', '角色ID(roleId,多个用逗号)', '邮箱(email)', '手机(phone)', '是否管理员(1/0)', '启用(1/0)']];
    const sample = [
      ['zhangsan', '张三', '123456', 1, '2', 'z@demo.com', '13800000000', 0, 1],
      ['lisi', '李四', '123456', 1, '3', 'l@demo.com', '13900000000', 0, 1],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...sample]);
    ws['!cols'] = header[0].map(() => ({ wch: 24 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户导入模板');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async importUsers(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const results: any[] = [];
    for (const row of rows) {
      try {
        const username = String(row['用户名(username)'] ?? row.username ?? '').trim();
        if (!username) { results.push({ ok: false, msg: '用户名为空' }); continue; }
        const exists = await this.prisma.sysUser.findUnique({ where: { username } });
        if (exists) { results.push({ ok: false, username, msg: '用户名已存在' }); continue; }
        const roleIdStr = String(row['角色ID(roleId,多个用逗号)'] ?? row.roleId ?? '').trim();
        const roleIds = roleIdStr ? roleIdStr.split(',').map((s: string) => Number(s.trim())).filter(Boolean) : [];
        const deptId = Number(row['部门ID(deptId)'] ?? row.deptId) || null;
        const created = await this.prisma.sysUser.create({
          data: {
            username,
            name: String(row['姓名(name)'] ?? row.name ?? username),
            password: String(row['密码(password)'] ?? row.password ?? '123456'),
            deptId,
            isAdmin: Number(row['是否管理员(1/0)'] ?? row.isAdmin ?? 0) === 1,
            isActive: Number(row['启用(1/0)'] ?? row.isActive ?? 1) === 1,
            email: String(row['邮箱(email)'] ?? row.email ?? '') || null,
            phone: String(row['手机(phone)'] ?? row.phone ?? '') || null,
            roles: roleIds.length ? { create: roleIds.map((roleId: number) => ({ roleId })) } : undefined,
          },
        });
        results.push({ ok: true, id: created.id, username });
      } catch (e: any) {
        results.push({ ok: false, msg: e?.message || '导入失败' });
      }
    }
    const success = results.filter((r) => r.ok).length;
    return { total: rows.length, success, failed: results.length - success, results };
  }

  // ============ 旧接口兼容 ============
  async listUsers(keyword?: string) {
    return this.prisma.sysUser.findMany({
      where: keyword ? { OR: [{ name: { contains: keyword } }, { username: { contains: keyword } }] } : {},
      select: { id: true, name: true, username: true, deptId: true, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async listRegions(parentId?: number) {
    return this.prisma.sysRegion.findMany({ where: { parentId: parentId ?? null }, orderBy: { id: 'asc' } });
  }

  async listRegionTree() {
    const all = await this.prisma.sysRegion.findMany({ orderBy: [{ level: 'asc' }, { id: 'asc' }] });
    const map = new Map<number, any>();
    all.forEach((r) => map.set(r.id, { value: r.id, label: r.name, level: r.level, parentId: r.parentId, children: [] as any[] }));
    const roots: any[] = [];
    map.forEach((node) => {
      if (node.level === 1 || node.parentId == null) roots.push(node);
      else {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
    });
    return roots;
  }

  // ============ 公司信息（单例） ============
  async getCompany() {
    let c = await this.prisma.sysCompany.findFirst({ orderBy: { id: 'asc' } });
    if (!c) {
      c = await this.prisma.sysCompany.create({ data: { name: '陕西飞创腾达电子科技有限公司' } });
    }
    return c;
  }

  async saveCompany(body: any) {
    const existing = await this.prisma.sysCompany.findFirst({ orderBy: { id: 'asc' } });
    const data: any = {
      name: body.name || '陕西飞创腾达电子科技有限公司',
      shortName: body.shortName ?? null,
      bankName: body.bankName ?? null,
      account: body.account ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      taxNo: body.taxNo ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      logoUrl: body.logoUrl ?? null,
      remark: body.remark ?? null,
    };
    if (existing) {
      return this.prisma.sysCompany.update({ where: { id: existing.id }, data });
    }
    return this.prisma.sysCompany.create({ data });
  }
}
