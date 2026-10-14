import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { applyDataScope } from '../../common/scope';

// 商务管理 → 采购模块
// 数据范围语义与 inventory 完全一致：
//  - admin/leader (isAdmin=true): 看全公司
//  - purchase / business 角色：看全公司
//  - sales / administrative 等其他角色：仅本人
// 模块级白名单硬编码：库存与采购共享同一套访问规则

const BIZ_ADMIN_ROLES = ['purchase', 'business', 'leader', 'admin'];

function isBizAdmin(user: any): boolean {
  if (user?.isAdmin === true) return true;
  const roles = user?.roleCodes || [];
  return roles.some((r: string) => BIZ_ADMIN_ROLES.includes(r));
}

@Injectable()
export class PurchaseService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(PurchaseService.name) private readonly logger: PinoLogger,
  ) {}

  async list(q: any, user: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 10, 1000);
    const where: any = { isActive: true };
    if (q.productName) where.productName = { contains: q.productName };
    if (q.productModel) where.productModel = { contains: q.productModel };
    if (q.manufacturer) where.manufacturer = { contains: q.manufacturer };

    const fullAccess = isBizAdmin(user);
    let scoped: any = where;
    if (!fullAccess) {
      scoped = await applyDataScope(this.prisma, user, where);
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bizPurchase.count({ where: scoped }),
      this.prisma.bizPurchase.findMany({
        where: scoped,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted' });

    const listWithSeq = items.map((it, idx) => ({
      ...it,
      seq: (page - 1) * pageSize + idx + 1,
    }));
    return { total, items: listWithSeq, page, pageSize };
  }

  async detail(id: number, user: any) {
    const item = await this.prisma.bizPurchase.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('采购不存在');
    if (!isBizAdmin(user)) {
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('采购不存在');
      }
    }
    return item;
  }

  async create(body: any, user: any) {
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
    return this.prisma.bizPurchase.create({ data });
  }

  async update(id: number, body: any, user: any) {
    const item = await this.prisma.bizPurchase.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('采购不存在');
    if (!isBizAdmin(user)) {
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('采购不存在');
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
    return this.prisma.bizPurchase.update({ where: { id }, data });
  }

  async remove(id: number, user: any) {
    const item = await this.prisma.bizPurchase.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('采购不存在');
    if (!isBizAdmin(user)) {
      if (item.ownerId !== user.id && item.createdById !== user.id) {
        throw new NotFoundException('采购不存在');
      }
    }
    return this.prisma.bizPurchase.update({
      where: { id },
      data: { isActive: false, updatedById: user.id },
    });
  }

  async export(user: any) {
    const where: any = { isActive: true };
    if (!isBizAdmin(user)) {
      const scoped = await applyDataScope(this.prisma, user, where);
      return this.prisma.bizPurchase.findMany({ where: scoped, orderBy: [{ date: 'desc' }, { id: 'desc' }] });
    }
    return this.prisma.bizPurchase.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }] });
  }
}