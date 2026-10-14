import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitize, cleanArrayFields } from '../../common/utils/payload';
import { applyDataScope } from '../../common/scope';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger('CustomerService') private readonly logger: PinoLogger,
  ) {}

  async nextCode() {
    // TOCTOU 修复：使用 PG SEQUENCE 原子计数器，并发安全。
    // 跨日重置在 SQL 迁移里完成（setval max_seq when max_seq>0）。
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    try {
      const [{ nextval }] = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('public.customer_code_seq') AS nextval
      `;
      return `KH${ymd}${String(Number(nextval)).padStart(4, '0')}`;
    } catch (e) {
      // 兜底：SEQUENCE 不存在时回退到 findFirst 旧逻辑（C1 策略）
      const last = await this.prisma.crmCustomer.findFirst({
        where: { code: { startsWith: `KH${ymd}` } },
        orderBy: { code: 'desc' },
      });
      let seq = 1;
      if (last) {
        const num = parseInt(String(last.code).slice(`KH${ymd}`.length), 10);
        if (!isNaN(num)) seq = num + 1;
      }
      return `KH${ymd}${String(seq).padStart(4, '0')}`;
    }
  }

  /** 构建列表排序条件。非法/空字段安全回退到 updatedAt 倒序。 */
  private buildCustomerOrderBy(sortField: string | undefined, sortOrder: string | undefined): any {
    const so: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    switch (sortField) {
      case 'owner': return { owner: { name: so } };
      case 'status': return { submitStatus: so };
      case 'code':
      case 'name':
      case 'followStage':
      case 'createdAt':
      case 'category':
      case 'type':
      case 'source':
      case 'industry':
      case 'valueRating':
      case 'creditLevel':
      case 'currencyCode':
      case 'address':
      case 'legalPerson':
      case 'registeredCapital':
      case 'bankName':
      case 'bankAccount':
      case 'taxId':
      case 'invoiceTitle':
      case 'paymentDays':
      case 'updatedAt':
        return { [sortField]: so };
      default:
        return { updatedAt: 'desc' };
    }
  }

  async list(q: any, user: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 10, 1000);
    const where: any = {};
    if (q.keyword) where.OR = [{ name: { contains: q.keyword } }, { code: { contains: q.keyword } }];
    if (q.category) where.category = q.category;
    if (q.followStage) where.followStage = q.followStage;
    if (q.valueRating) where.valueRating = q.valueRating;
    if (q.industry) where.industry = q.industry;
    if (q.ownerId) where.ownerId = Number(q.ownerId);
    const scoped = await applyDataScope(this.prisma, user, where);

    const orderBy = this.buildCustomerOrderBy(q.sortField, q.sortOrder);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.crmCustomer.count({ where: scoped }),
      this.prisma.crmCustomer.findMany({
        where: scoped,
        include: { owner: { select: { id: true, name: true } }, contacts: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted'});

    const ids = items.map((i) => i.id);
    const inherits = ids.length
      ? await this.prisma.crmCustomerInherit.findMany({
          where: { customerId: { in: ids } },
          orderBy: { inheritedAt: 'desc' },
        })
      : [];
    const inheritMap = new Map<number, any>();
    for (const it of inherits) if (!inheritMap.has(it.customerId)) inheritMap.set(it.customerId, it);

    const list = items.map((i) => ({
      ...i,
      inheritDate: inheritMap.get(i.id)?.inheritedAt || null,
    }));
    return { total, items: list, page, pageSize };
  }

  async detail(id: number) {
    const c = await this.prisma.crmCustomer.findUnique({
      where: { id },
      include: {
        contacts: true,
        follows: { include: { follower: { select: { id: true, name: true } } }, orderBy: { followDate: 'desc' } },
        inherits: { orderBy: { inheritedAt: 'desc' } },
      },
    });
    if (!c) throw new NotFoundException('客户不存在');
    if (c.inherits?.length) {
      const uids = Array.from(new Set(c.inherits.flatMap((i: any) => [i.fromUserId, i.toUserId, i.inheritedById])));
      const users = await this.prisma.sysUser.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } });
      const nameMap = new Map(users.map((u: any) => [u.id, u.name]));
      c.inherits = c.inherits.map((i: any) => ({
        ...i,
        fromUser: { name: nameMap.get(i.fromUserId) || '' },
        toUser: { name: nameMap.get(i.toUserId) || '' },
        inheritedBy: { name: nameMap.get(i.inheritedById) || '' },
      }));
    }
    return c;
  }

  async create(body: any, user: any) {
    body = sanitize('CrmCustomer', body);
    const { contacts, ...rest } = body;
    const code = rest.code || (await this.nextCode());
    const data: any = { ...rest, code, createdById: user.id, ownerId: rest.ownerId ?? user.id, deptId: user.deptId ?? rest.deptId };
    for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities'])
      delete data[k];
    // 系统自动管理的字段：前端 Object.assign 整对象时会带进来，必须显式剥掉
    // （CrmCustomerScalarFieldEnum 包含 id/createdAt 等，所以 scrub 不会剥它们，
    //  不剥 id 会导致 Prisma update 报 "Unknown argument id"）
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.createdById;
    this.cleanEmpty(data, [
      'stateId', 'cityId', 'districtId', 'paymentDays', 'settleDay', 'ownerId', 'deptId',
      'paymentLimitPct', 'registeredCapital',
    ]);
    cleanArrayFields(data, ['sharedUserIds']);
    if (Array.isArray(contacts)) data.contacts = { create: contacts };
    return this.prisma.crmCustomer.create({ data, include: { contacts: true } });
  }

  async update(id: number, body: any, user: any) {
    body = sanitize('CrmCustomer', body);
    const { contacts, ...rest } = body;
    const data: any = { ...rest, updatedById: user.id };
    for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities'])
      delete data[k];
    // 系统自动管理的字段：前端 Object.assign 整对象时会带进来，必须显式剥掉
    // （主键 id 不可写；createdAt/updatedAt 由 Prisma @updatedAt/@default 管理；createdById 创建后不可改）
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.createdById;
    this.cleanEmpty(data, [
      'stateId', 'cityId', 'districtId', 'paymentDays', 'settleDay', 'ownerId', 'deptId',
      'paymentLimitPct', 'registeredCapital',
    ]);
    cleanArrayFields(data, ['sharedUserIds']);
    return this.prisma.$transaction(async (tx) => {
      if (Array.isArray(contacts)) {
        await tx.crmContact.deleteMany({ where: { customerId: id } });
        // 去掉 create 不接受的字段：id（自动递增）、customerId（外键已固定）、createdAt/updatedAt
        const safeContacts = contacts.map((c: any) => {
          const { id: _id, customerId: _cid, createdAt: _ca, updatedAt: _ua, ...rest } = c;
          return rest;
        });
        data.contacts = { create: safeContacts };
      }
      return tx.crmCustomer.update({ where: { id }, data, include: { contacts: true } });
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 });
  }

  /**
   * 把指定 Int?/Decimal? 字段的空串 / null 转为 undefined，
   * 避免 Prisma 报 "Invalid value '' for type integer/numeric"。
   * （前端 el-input / el-input-number 未填时回填 ''）
   */
  private cleanEmpty(obj: any, fields: string[]) {
    if (!obj) return obj;
    for (const f of fields) {
      if (obj[f] === '' || obj[f] === null) obj[f] = undefined;
    }
    return obj;
  }

  /**
   * 把联系人字段从 string | string[] 规范化为数据库存储的拼接字符串。
   * - null/undefined/空数组/纯空白 → null
   * - 数组 → 用 ';' 拼接并去空
   * - 字符串 → trim
   * 数据库字段为 String? VarChar(50)，上限约 5~7 个姓名，够用。
   */
  private normalizeContactName(v: any): string | null {
    if (v == null) return null;
    if (Array.isArray(v)) {
      const parts = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
      if (parts.length === 0) return null;
      return parts.join(';');
    }
    const s = String(v).trim();
    return s ? s : null;
  }

  async remove(id: number, user: any) {
    // 仅管理员可删客户；销售员无此权限（前端 UI 已隐藏，后端二次防御）
    if (!user?.isAdmin) {
      throw new ForbiddenException('仅管理员可删除客户');
    }
    return this.prisma.crmCustomer.delete({ where: { id } });
  }

  async inherit(id: number, toUserId: number, reason: string, user: any) {
    const c = await this.prisma.crmCustomer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('客户不存在');
    return this.prisma.$transaction(async (tx) => {
      await tx.crmCustomerInherit.create({
        data: { customerId: id, fromUserId: c.ownerId ?? user.id, toUserId, inheritedById: user.id, reason },
      });
      return tx.crmCustomer.update({ where: { id }, data: { ownerId: toUserId } });
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 });
  }

  async getFollows(customerId: number) {
    return this.prisma.crmCustomerFollow.findMany({
      where: { customerId },
      include: { follower: { select: { id: true, name: true } } },
      orderBy: { followDate: 'desc' },
    });
  }

  async addFollow(customerId: number, body: any, user: any) {
    const data: any = {
      customerId,
      followerId: body.followerId ?? user.id,
      followDate: body.followDate ? new Date(body.followDate) : new Date(),
      period: body.period ?? null,
      schedule: body.schedule ?? null,
      contactName: this.normalizeContactName(body.contactName),
      content: body.content ?? '',
    };
    for (const k of ['follower', 'customer']) delete data[k];
    return this.prisma.crmCustomerFollow.create({
      data,
      include: { follower: { select: { id: true, name: true } } },
    });
  }

  async updateFollow(customerId: number, followId: number, body: any, user: any) {
    // 校验 followId 属于该 customer
    const exist = await this.prisma.crmCustomerFollow.findFirst({ where: { id: followId, customerId } });
    if (!exist) throw new NotFoundException('跟进记录不存在');
    const data: any = {};
    if (body.followDate !== undefined) data.followDate = body.followDate ? new Date(body.followDate) : new Date();
    if (body.period !== undefined) data.period = body.period;
    if (body.schedule !== undefined) data.schedule = body.schedule;
    if (body.contactName !== undefined) data.contactName = this.normalizeContactName(body.contactName);
    if (body.content !== undefined) data.content = body.content ?? '';
    if (body.followerId !== undefined) data.followerId = body.followerId;
    return this.prisma.crmCustomerFollow.update({
      where: { id: followId },
      data,
      include: { follower: { select: { id: true, name: true } } },
    });
  }

  async deleteFollow(customerId: number, followId: number, user: any) {
    const exist = await this.prisma.crmCustomerFollow.findFirst({ where: { id: followId, customerId } });
    if (!exist) throw new NotFoundException('跟进记录不存在');
    // 删除权限：跟进创建人本人 或 管理员
    if (exist.followerId !== user.id && !user?.isAdmin) {
      throw new ForbiddenException('仅跟进创建人或管理员可删除');
    }
    await this.prisma.crmCustomerFollow.delete({ where: { id: followId } });
    return { ok: true, id: followId };
  }

  async search(keyword: string, user: any) {
    const where: any = keyword
      ? { OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }] }
      : {};
    const scoped = await applyDataScope(this.prisma, user, where);
    const rows = await this.prisma.crmCustomer.findMany({
      where: scoped,
      select: { id: true, code: true, name: true, ownerId: true, address: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    this.logger.info({
      kw: keyword,
      dataScope: user?.dataScope,
      userId: user?.id,
      rows: rows.length,
    }, 'customer.search done');
    return rows;
  }
}
