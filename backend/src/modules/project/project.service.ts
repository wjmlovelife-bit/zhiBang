import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitize, cleanArrayFields } from '../../common/utils/payload';
import { applyDataScope } from '../../common/scope';
import { PdfService } from '../../common/pdf/pdf.service';
import { renderPdf } from '../../common/pdf/templates';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    @InjectPinoLogger('ProjectService') private readonly logger: PinoLogger,
  ) {}

  /** 从公司信息表取名称，失败回退到默认值 */
  private async getCompanyName(): Promise<string> {
    try {
      const c = await this.prisma.sysCompany.findFirst({ orderBy: { id: 'asc' } });
      return c?.name || '智邦科技有限公司';
    } catch {
      return '智邦科技有限公司';
    }
  }

  /**
   * 把联系人字段从 string | string[] 规范化为数据库存储的拼接字符串。
   * - null/undefined/空数组/纯空白 → null
   * - 数组 → 用 ';' 拼接并去空
   * - 字符串 → trim
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

  async nextCode() {
    // TOCTOU 修复：使用 PG SEQUENCE 原子计数器，并发安全。
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    try {
      const [{ nextval }] = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('public.project_code_seq') AS nextval
      `;
      return `XM${ymd}${String(Number(nextval)).padStart(4, '0')}`;
    } catch (e) {
      // 兜底：SEQUENCE 不存在时回退到 findFirst 旧逻辑
      const prefix = `XM${ymd}`;
      const last = await this.prisma.crmOpportunity.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
      });
      let seq = 1;
      if (last) {
        const num = parseInt(String(last.code).slice(prefix.length), 10);
        if (!isNaN(num)) seq = num + 1;
      }
      return `${prefix}${String(seq).padStart(4, '0')}`;
    }
  }

  /** 构建列表排序条件。非法/空字段安全回退到 updatedAt 倒序。 */
  private buildProjectOrderBy(sortField: string | undefined, sortOrder: string | undefined): any {
    const so: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    switch (sortField) {
      case 'owner': return { owner: { name: so } };
      case 'customer': return { customer: { name: so } };
      case 'contract': return { contract: { title: so } };
      case 'status': return { submitStatus: so };
      case 'dateOpen': return { dateOpen: so };
      case 'lastFollow': return { lastFollowDate: so };
      case 'code':
      case 'name':
      case 'category':
      case 'stage':
      case 'source':
      case 'state':
      case 'currencyCode':
      case 'expectedRevenue':
      case 'amountFinal':
      case 'plannedCost':
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
    if (q.ownerId) where.ownerId = Number(q.ownerId);
    if (q.customerId) where.customerId = Number(q.customerId);
    if (q.category) where.category = q.category;
    if (q.stage) where.stage = q.stage;
    if (q.state) where.state = q.state;
    if (q.dateOpenStart) where.dateOpen = { gte: new Date(q.dateOpenStart) };
    if (q.dateOpenEnd) where.dateOpen = { ...(where.dateOpen || {}), lte: new Date(q.dateOpenEnd) };
    if (q.followStart) where.lastFollowDate = { gte: new Date(q.followStart) };
    if (q.followEnd) where.lastFollowDate = { ...(where.lastFollowDate || {}), lte: new Date(q.followEnd) };
    const scoped = await applyDataScope(this.prisma, user, where);

    const orderBy = this.buildProjectOrderBy(q.sortField, q.sortOrder);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.crmOpportunity.count({ where: scoped }),
      this.prisma.crmOpportunity.findMany({
        where: scoped,
        include: {
          owner: { select: { id: true, name: true } },
          customer: { select: { id: true, code: true, name: true } },
          contract: { select: { id: true, code: true, title: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted'});

    const ids = items.map((i) => i.id);
    const inherits = ids.length
      ? await this.prisma.crmProjectInherit.findMany({
          where: { projectId: { in: ids } },
          orderBy: { inheritedAt: 'desc' },
        })
      : [];
    const inheritMap = new Map<number, any>();
    for (const it of inherits) if (!inheritMap.has(it.projectId)) inheritMap.set(it.projectId, it);

    const list = items.map((i) => ({
      ...i,
      inheritDate: inheritMap.get(i.id)?.inheritedAt || null,
    }));
    return { total, items: list, page, pageSize };
  }

  async detail(id: number) {
    const o = await this.prisma.crmOpportunity.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        items: { orderBy: { sort: 'asc' } },
        follows: { include: { follower: { select: { id: true, name: true } } }, orderBy: { followDate: 'desc' } },
        inherits: { orderBy: { inheritedAt: 'desc' } },
        customer: { select: { id: true, code: true, name: true } },
        contract: { select: { id: true, code: true, title: true } },
      },
    });
    if (!o) throw new NotFoundException('项目不存在');
    if (o.inherits?.length) {
      const uids = Array.from(new Set(o.inherits.flatMap((i: any) => [i.fromUserId, i.toUserId, i.inheritedById])));
      const users = await this.prisma.sysUser.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } });
      const nameMap = new Map(users.map((u: any) => [u.id, u.name]));
      o.inherits = o.inherits.map((i: any) => ({
        ...i,
        fromUser: { name: nameMap.get(i.fromUserId) || '' },
        toUser: { name: nameMap.get(i.toUserId) || '' },
        inheritedBy: { name: nameMap.get(i.inheritedById) || '' },
      }));
    }
    return o;
  }

  private calcAmountFinal(expectedRevenue?: number | string, discountPct?: number | string) {
    if (expectedRevenue == null) return null;
    const rev = Number(expectedRevenue);
    const pct = discountPct == null ? 10 : Number(discountPct);
    return Math.round(rev * (pct / 10) * 100) / 100;
  }

  private async buildData(body: any, user: any, isUpdate: boolean) {
    body = sanitize('CrmOpportunity', body);
    const { items, follows, owner, customer, contract, inherits, createdBy, updatedBy, _count, ...rest } = body;
    const data: any = { ...rest };
    // 系统自动管理的字段：前端 Object.assign 整对象时会带进来，必须显式剥掉
    // （主键 id 不可写；createdAt/updatedAt 由 Prisma @updatedAt/@default 管理；createdById 创建后不可改）
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.createdById;
    // 前端 el-date-picker / el-input-number 未填时回填 '' / []，Prisma 无法把 '' 塞进
    // Int?/Decimal?/DateTime? 列，会报 "Invalid value ... Expected Int/ISO-8601 DateTime" → 500
    this.cleanEmpty(data, [
      // Int?
      'customerId', 'stateId', 'cityId', 'districtId', 'contractId', 'workflowId',
      // DateTime?
      'projectDate', 'lastFollowDate', 'expectedDate',
      // Decimal?
      'expectedRevenue', 'discountPct', 'plannedCost', 'discountValue', 'amountTotal',
    ]);
    // contactIds 若是字符串（前端误传），回退为空数组
    if (typeof data.contactIds === 'string') data.contactIds = [];
    cleanArrayFields(data, ['contactIds']);
    if (rest.expectedRevenue !== undefined || rest.discountPct !== undefined) {
      data.amountFinal = this.calcAmountFinal(
        rest.expectedRevenue ?? undefined,
        rest.discountPct ?? undefined,
      );
    }
    if (rest.provinceName || rest.cityName || rest.districtName) {
      data.region = [rest.provinceName, rest.cityName, rest.districtName].filter(Boolean);
    }
    if (!isUpdate) {
      data.createdById = user.id;
      data.ownerId = rest.ownerId ?? user.id;
      data.deptId = user.deptId ?? rest.deptId;
    }
    // 14. 日志：清洗后落盘关键字段，P2003/FK 错误时能看到完整链路
    this.logger.debug({
      isUpdate,
      bodyKeys: Object.keys(body).slice(0, 20),
      dataKeys: Object.keys(data).slice(0, 20),
      ownerId: data.ownerId,
      deptId: data.deptId,
      customerCode: data.customerCode,
      customerId: data.customerId,
      itemsCount: Array.isArray(items) ? items.length : 0,
      followsCount: Array.isArray(follows) ? follows.length : 0,
    }, 'buildData done');
    return { data, items, follows };
  }

  /**
   * 把指定 Int?/Decimal?/DateTime? 字段的空串 / null 转为 undefined，
   * 避免 Prisma 报 "Invalid value '' for type timestamp/numeric/integer"。
   */
  private cleanEmpty(obj: any, fields: string[]) {
    if (!obj) return obj;
    for (const f of fields) {
      if (obj[f] === '' || obj[f] === null) obj[f] = undefined;
    }
    return obj;
  }

  async create(body: any, user: any) {
    this.logger.info({ userId: user?.id, bodyKeys: Object.keys(body || {}) }, 'project.create start');
    const { data, items, follows } = await this.buildData(body, user, false);
    data.code = body.code || (await this.nextCode());
    if (Array.isArray(items)) data.items = { create: items.map((it: any) => this.stripItemId(it)) };
    // R17 3.1：包 $transaction，避免项目建成功但初始 follow 丢失的不一致
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.crmOpportunity.create({ data, include: { items: true } });
      if (Array.isArray(follows) && follows.length) {
        await tx.crmProjectFollow.createMany({
          data: follows.map((f: any) => ({
            projectId: created.id,
            followerId: f.followerId ?? user.id,
            followDate: f.followDate ? new Date(f.followDate) : new Date(),
            contactName: f.contactName ?? null,
            content: f.content ?? '',
          })),
        });
      }
      return created;
    }, { isolationLevel: 'ReadCommitted' });
    this.logger.info({ projectId: result.id, code: result.code }, 'project.create done');
    return result;
  }

  async update(id: number, body: any, user: any) {
    const { data, items } = await this.buildData(body, user, true);
    // R17 3.1：包 $transaction，避免 deleteMany 成功但 items.create 失败导致项目无 item
    return this.prisma.$transaction(async (tx) => {
      if (Array.isArray(items)) {
        await tx.crmProjectItem.deleteMany({ where: { projectId: id } });
        data.items = { create: items.map((it: any) => this.stripItemId(it)) };
      }
      return tx.crmOpportunity.update({ where: { id }, data, include: { items: true } });
    }, { isolationLevel: 'ReadCommitted' });
  }

  // 主子表更新：剥离子行的自增 id / 外键 / 时间戳，避免 Prisma create 报 "Unknown argument id"
  private stripItemId(it: any) {
    const { id, projectId, opportunityId, createdAt, updatedAt, ...rest } = it;
    return rest;
  }

  async remove(id: number, user: any) {
    // 权限闸门：仅管理员(dataScope=1)可删除项目，销售等角色返回 403
    if (!user || user.dataScope !== 1) {
      throw new ForbiddenException('仅管理员可删除项目');
    }
    return this.prisma.crmOpportunity.delete({ where: { id } });
  }

  async inherit(id: number, toUserId: number, reason: string, user: any) {
    const o = await this.prisma.crmOpportunity.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('项目不存在');
    // R17 3.1：包 $transaction，避免 inherit 写成功但 ownerId 没改的不一致
    return this.prisma.$transaction(async (tx) => {
      await tx.crmProjectInherit.create({
        data: { projectId: id, fromUserId: o.ownerId ?? user.id, toUserId, inheritedById: user.id, reason },
      });
      return tx.crmOpportunity.update({ where: { id }, data: { ownerId: toUserId } });
    }, { isolationLevel: 'ReadCommitted' });
  }

  async addFollow(id: number, body: any, user: any) {
    const data: any = {
      projectId: id,
      followerId: body.followerId ?? user.id,
      followDate: body.followDate ? new Date(body.followDate) : new Date(),
      period: body.period ?? null,
      schedule: body.schedule ?? null,
      contactName: this.normalizeContactName(body.contactName),
      content: body.content ?? '',
    };
    // R17 3.1：包 $transaction，避免 follow 写成功但 lastFollowDate 没更新
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.crmProjectFollow.create({
        data,
        include: { follower: { select: { id: true, name: true } } },
      });
      await tx.crmOpportunity.update({
        where: { id },
        data: { lastFollowDate: data.followDate },
      });
      return created;
    }, { isolationLevel: 'ReadCommitted' });
  }

  async updateFollow(projectId: number, followId: number, body: any, user: any) {
    // 校验 followId 属于该项目
    const exist = await this.prisma.crmProjectFollow.findFirst({ where: { id: followId, projectId } });
    if (!exist) throw new NotFoundException('跟进记录不存在');
    const data: any = {};
    if (body.followDate !== undefined) data.followDate = body.followDate ? new Date(body.followDate) : new Date();
    if (body.period !== undefined) data.period = body.period;
    if (body.schedule !== undefined) data.schedule = body.schedule;
    if (body.contactName !== undefined) data.contactName = this.normalizeContactName(body.contactName);
    if (body.content !== undefined) data.content = body.content ?? '';
    if (body.followerId !== undefined) data.followerId = body.followerId;
    return this.prisma.crmProjectFollow.update({
      where: { id: followId },
      data,
      include: { follower: { select: { id: true, name: true } } },
    });
  }

  async deleteFollow(projectId: number, followId: number, user: any) {
    const exist = await this.prisma.crmProjectFollow.findFirst({ where: { id: followId, projectId } });
    if (!exist) throw new NotFoundException('跟进记录不存在');
    // 删除权限：跟进创建人本人 或 管理员
    if (exist.followerId !== user.id && !user?.isAdmin) {
      throw new ForbiddenException('仅跟进创建人或管理员可删除');
    }
    await this.prisma.crmProjectFollow.delete({ where: { id: followId } });
    return { ok: true, id: followId };
  }

  async searchCustomer(keyword: string, user: any) {
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
    }, 'searchCustomer done');
    return rows;
  }

  async searchContract(keyword: string) {
    const where: any = keyword
      ? { OR: [{ title: { contains: keyword } }, { code: { contains: keyword } }, { customerName: { contains: keyword } }] }
      : {};
    return this.prisma.salesContract.findMany({
      where,
      select: { id: true, code: true, title: true, customerName: true },
      take: 20,
    });
  }

  // 导入预览：必填校验
  async importPreview(rows: any[]) {
    const required = ['name', 'customerCode', 'dateOpen', 'category', 'stage', 'source', 'state', 'ownerId'];
    const valid: any[] = [];
    const invalid: any[] = [];
    rows.forEach((row, idx) => {
      const miss = required.filter((k) => row[k] === undefined || row[k] === null || row[k] === '');
      if (miss.length) invalid.push({ row: idx + 2, data: row, miss });
      else valid.push(row);
    });
    return { total: rows.length, validCount: valid.length, invalidCount: invalid.length, valid, invalid };
  }

  async importConfirm(rows: any[], user: any) {
    const created: any[] = [];
    for (const row of rows) {
      const data: any = {
        code: await this.nextCode(),
        name: row.name,
        customerCode: row.customerCode,
        customerId: row.customerId ? Number(row.customerId) : null,
        dateOpen: new Date(row.dateOpen),
        category: row.category,
        stage: row.stage,
        source: row.source,
        state: row.state,
        ownerId: Number(row.ownerId),
        currencyCode: row.currencyCode,
        expectedRevenue: row.expectedRevenue ? Number(row.expectedRevenue) : null,
        discountPct: row.discountPct ? Number(row.discountPct) : null,
        amountFinal: this.calcAmountFinal(row.expectedRevenue, row.discountPct),
        plannedCost: row.plannedCost ? Number(row.plannedCost) : null,
        projectDate: row.projectDate ? new Date(row.projectDate) : null,
        description: row.description,
        createdById: user.id,
        submitStatus: row.submitStatus || 'active',
      };
      if (row.provinceName || row.cityName || row.districtName)
        data.region = [row.provinceName, row.cityName, row.districtName].filter(Boolean);
      created.push(await this.prisma.crmOpportunity.create({ data }));
    }
    return { count: created.length };
  }

  exportCsv(ids?: number[]) {
    const where = ids && ids.length ? { id: { in: ids } } : {};
    return this.prisma.crmOpportunity.findMany({
      where,
      include: { owner: { select: { name: true } } },
      orderBy: { id: 'desc' },
    });
  }

  private fmtDate(v: any): string {
    return v ? new Date(v).toISOString().slice(0, 10) : '-';
  }
  private fmtMoney(v: any): string {
    if (v == null || v === '') return '-';
    const n = Number(v);
    if (isNaN(n)) return String(v);
    const [int, dec] = n.toFixed(2).split('.');
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
  }

  async generatePdf(id: number) {
    const o = await this.detail(id);
    const data = {
      companyName: '智邦科技有限公司',
      docTitle: '项目信息表',
      now: this.fmtDate(new Date()),
      code: o.code || '',
      name: o.name || '',
      customerName: o.customer?.name || '',
      customerCode: o.customerCode || '',
      owner: o.owner?.name || '',
      category: o.category || '',
      stage: o.stage || '',
      source: o.source || '',
      state: o.state || '',
      dateOpen: this.fmtDate(o.dateOpen),
      expectedRevenue: this.fmtMoney(o.expectedRevenue),
      discountPct: o.discountPct != null ? `${o.discountPct} 折` : '-',
      amountFinal: this.fmtMoney(o.amountFinal),
      plannedCost: this.fmtMoney(o.plannedCost),
      projectDate: this.fmtDate(o.projectDate),
      description: o.description || '',
      items: (o.items || []).map((it: any) => ({
        productName: it.productName || '',
        productCode: it.productCode || '',
        model: it.model || '',
        unitPrice: this.fmtMoney(it.unitPrice),
        quantity: it.quantity ?? '',
        amount: this.fmtMoney(it.amount),
      })),
    };
    const html = renderPdf('project', data);
    return this.pdf.htmlToPdf(html);
  }
}
