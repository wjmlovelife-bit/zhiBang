import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { applyDataScope } from '../../common/scope';

// 商务管理 → 库存模块
// 数据范围语义：
//  - admin/leader (isAdmin=true): 看全公司
//  - purchase / business 角色：看全公司（业务规则：这两个角色对库存模块有全访问权）
//  - sales / administrative 等其他角色：仅本人（ownerId/createdById）
//  - 即角色数据范围(dataScope) 不直接用于本模块，按"模块级白名单"判断

// 模块级全访问角色（白名单）：看到全公司库存数据
const BIZ_ADMIN_ROLES = ['purchase', 'business', 'leader', 'admin'];

function isBizAdmin(user: any): boolean {
  if (user?.isAdmin === true) return true;
  const roles = user?.roleCodes || [];
  return roles.some((r: string) => BIZ_ADMIN_ROLES.includes(r));
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(InventoryService.name) private readonly logger: PinoLogger,
  ) {}

  async list(q: any, user: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 10, 1000);
    const where: any = { isActive: true };
    if (q.productName) where.productName = { contains: q.productName };
    if (q.productModel) where.productModel = { contains: q.productModel };
    if (q.manufacturer) where.manufacturer = { contains: q.manufacturer };

    // 模块级白名单判断：admin/leader + purchase/business 角色看全公司
    const fullAccess = isBizAdmin(user);
    let scoped: any = where;
    if (!fullAccess) {
      // 其他角色（sales/administrative）走 applyDataScope 过滤 ownerId/createdById
      scoped = await applyDataScope(this.prisma, user, where);
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bizInventory.count({ where: scoped }),
      this.prisma.bizInventory.findMany({
        where: scoped,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted' });

    // 序号：从 1 开始递增（前端展示用）
    const listWithSeq = items.map((it, idx) => ({
      ...it,
      seq: (page - 1) * pageSize + idx + 1,
    }));
    return { total, items: listWithSeq, page, pageSize };
  }

  async detail(id: number, user: any) {
    const item = await this.prisma.bizInventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('库存不存在');
    // 模块级白名单：admin/leader + purchase/business 直接放行
    if (!isBizAdmin(user)) {
      // 其他角色：仅本人能看（ownerId 或 createdById 等于自己）
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('库存不存在');
      }
    }
    return item;
  }

  async create(body: any, user: any) {
    this.logger.info({ userId: user?.id, productName: body?.productName }, 'inventory.create start');
    // 必填校验：商品名称、商品型号、厂家
    if (!body.productName || !body.productModel || !body.manufacturer) {
      throw new NotFoundException('商品名称、商品型号、厂家为必填字段');
    }
    const data: any = {
      productName: body.productName,
      productModel: body.productModel,
      manufacturer: body.manufacturer,
      date: body.date ? new Date(body.date) : new Date(),
      remark: body.remark || null,
      attachments: body.attachments || null,
      ownerId: body.ownerId ?? user.id,
      deptId: body.deptId ?? user.deptId ?? null,
      createdById: user.id,
      updatedById: user.id,
    };
    return this.prisma.bizInventory.create({ data });
  }

  async update(id: number, body: any, user: any) {
    const item = await this.prisma.bizInventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('库存不存在');
    if (!isBizAdmin(user)) {
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('库存不存在');
      }
    }
    const data: any = {
      updatedById: user.id,
    };
    if (body.productName !== undefined) data.productName = body.productName;
    if (body.productModel !== undefined) data.productModel = body.productModel;
    if (body.manufacturer !== undefined) data.manufacturer = body.manufacturer;
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
    if (body.remark !== undefined) data.remark = body.remark;
    if (body.attachments !== undefined) data.attachments = body.attachments;
    return this.prisma.bizInventory.update({ where: { id }, data });
  }

  async remove(id: number, user: any) {
    const item = await this.prisma.bizInventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('库存不存在');
    if (!isBizAdmin(user)) {
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('库存不存在');
      }
    }
    // 软删除：isActive=false
    return this.prisma.bizInventory.update({
      where: { id },
      data: { isActive: false, updatedById: user.id },
    });
  }

  /**
   * 导出 Excel：调用方已把数据加载到后，由 service 拼成 xlsx 格式返回 buffer
   * 简化：返回 JSON 数组让前端拼 xlsx（与现有项目惯例一致：前端用 xlsx 库）
   */
  async export(user: any) {
    const where: any = { isActive: true };
    if (!isBizAdmin(user)) {
      const scoped = await applyDataScope(this.prisma, user, where);
      return this.prisma.bizInventory.findMany({ where: scoped, orderBy: [{ date: 'desc' }, { id: 'desc' }] });
    }
    return this.prisma.bizInventory.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }] });
  }
}