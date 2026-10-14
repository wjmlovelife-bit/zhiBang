import { Injectable, ForbiddenException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 跟进相关通用接口（拉客户联系人候选池等）。
 * 不挂在 customer/project 下，避免循环依赖和过深的路由前缀。
 */
@Injectable()
export class FollowService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger('FollowService') private readonly logger: PinoLogger,
  ) {}

  /**
   * 取跟进记录"客户联系人"下拉池的联系人。
   * - 管理员（user.isAdmin=true）：全公司所有客户的所有 CrmContact
   * - 普通用户：自己作为 owner 的所有客户的所有 CrmContact
   * - 跨用户：followerId 必须等于 user.id（防御越权）
   * 返回：[{ contactId, contactName, customerId, customerName, mobile, department, position }]
   */
  async getContactsByFollower(followerId: number, user: any) {
    if (!followerId) return [];
    this.logger.info({ followerId, isAdmin: user?.isAdmin, dataScope: user?.dataScope, userId: user?.id }, 'getContactsByFollower start');

    // 权限校验：跨用户查询仅管理员豁免
    if (!user?.isAdmin && followerId !== user?.id) {
      throw new ForbiddenException('仅可查询自己的联系人池');
    }

    let customerIds: number[];
    if (user?.isAdmin) {
      // 管理员：全公司所有客户
      const all = await this.prisma.crmCustomer.findMany({ select: { id: true } });
      customerIds = all.map((c) => c.id);
    } else {
      // 普通用户：自己作为 owner 的所有客户
      const owned = await this.prisma.crmCustomer.findMany({
        where: { ownerId: followerId },
        select: { id: true },
      });
      customerIds = owned.map((c) => c.id);
    }

    if (customerIds.length === 0) {
      this.logger.info({ customerIds: 0, contacts: 0 }, 'getContactsByFollower done');
      return [];
    }

    const customers = await this.prisma.crmCustomer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        name: true,
        contacts: {
          select: {
            id: true,
            name: true,
            mobile: true,
            department: true,
            position: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    const result: any[] = [];
    for (const c of customers) {
      for (const ct of c.contacts) {
        result.push({
          contactId: ct.id,
          contactName: ct.name,
          customerId: c.id,
          customerName: c.name,
          mobile: ct.mobile,
          department: ct.department,
          position: ct.position,
        });
      }
    }
    this.logger.info({ customerIds: customerIds.length, customers: customers.length, contacts: result.length }, 'getContactsByFollower done');
    return result;
  }
}