import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitize } from '../../common/utils/payload';
import { applyDataScope } from '../../common/scope';

@Injectable()
export class WorkLogService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(WorkLogService.name) private readonly logger: PinoLogger,
  ) {}

  async nextCode() {
    // TOCTOU 修复：使用 PG SEQUENCE 原子计数器，并发安全。
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    try {
      const [{ nextval }] = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('public.worklog_code_seq') AS nextval
      `;
      return `RJ${ymd}${String(Number(nextval)).padStart(4, '0')}`;
    } catch (e) {
      // 兜底：SEQUENCE 不存在时回退到 findFirst 旧逻辑
      const prefix = `RJ${ymd}`;
      const last = await this.prisma.crmWorkLog.findFirst({
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

  /** 取不晚于今天的那个周六 00:00（本地时间） */
  private startOfLastSaturday(): Date {
    const now = new Date();
    const day = now.getDay(); // 0=周日
    const daysToLastSaturday = day === 6 ? 0 : day + 1; // 周六→0,周日→1,周一→2,...周五→6
    const lastSaturday = new Date(now);
    lastSaturday.setDate(now.getDate() - daysToLastSaturday);
    lastSaturday.setHours(0, 0, 0, 0);
    return lastSaturday;
  }

  /** 数据范围：1全部 / 4本人 / 2本部门及下级 / 3本部门 / 5自定义部门 */
  async list(q: any, user: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 10, 1000);
    const customerPage = Number(q.customerPage) || 1;
    const customerPageSize = Math.min(Number(q.customerPageSize) || 10, 1000);
    const projectPage = Number(q.projectPage) || 1;
    const projectPageSize = Math.min(Number(q.projectPageSize) || 10, 1000);
    const hasDate = !!(q.dateStart || q.dateEnd);

    // ===== 1. 变更表的时间区间 =====
    // 用户选了什么区间就用什么区间；否则默认上周六 00:00 → 现在
    let changeRange: any = {};
    if (q.dateStart) {
      changeRange.gte = new Date(`${q.dateStart}T00:00:00.000Z`);
    } else {
      changeRange.gte = this.startOfLastSaturday();
    }
    if (q.dateEnd) {
      changeRange.lte = new Date(`${q.dateEnd}T23:59:59.999Z`);
    } else {
      changeRange.lte = new Date();
    }

    // 变更表：只筛 ownerId（人员）
    const ownerWhere: any = q.ownerId ? { ownerId: Number(q.ownerId) } : {};

    // ===== 2. 客户/项目变更表（始终返回，应用数据权限 + 分页） =====
    const customerWhere = await applyDataScope(this.prisma, user, { ...ownerWhere, updatedAt: changeRange });
    const projectWhere = await applyDataScope(this.prisma, user, { ...ownerWhere, updatedAt: changeRange });
    const [customerTotal, changedCustomers, projectTotal, changedProjects] = await Promise.all([
      this.prisma.crmCustomer.count({ where: customerWhere }),
      this.prisma.crmCustomer.findMany({
        where: customerWhere,
        include: {
          owner: { select: { id: true, name: true } },
          contacts: { take: 1, select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (customerPage - 1) * customerPageSize,
        take: customerPageSize,
      }),
      this.prisma.crmOpportunity.count({ where: projectWhere }),
      this.prisma.crmOpportunity.findMany({
        where: projectWhere,
        include: {
          owner: { select: { id: true, name: true } },
          customer: { select: { id: true, code: true, name: true } },
          contract: { select: { id: true, code: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (projectPage - 1) * projectPageSize,
        take: projectPageSize,
      }),
    ]);

    // ===== 3. 工作日志列表（选时间才筛） =====
    let total = 0;
    let items: any[] = [];
    if (hasDate) {
      // 选了时间段：按时间筛
      const dateRange: any = {};
      if (q.dateStart) dateRange.gte = new Date(`${q.dateStart}T00:00:00.000Z`);
      if (q.dateEnd) dateRange.lte = new Date(`${q.dateEnd}T23:59:59.999Z`);

      const where: any = { date: dateRange };
      if (q.keyword) where.OR = [{ content: { contains: q.keyword } }, { code: { contains: q.keyword } }];
      if (q.ownerId) where.ownerId = Number(q.ownerId);
      if (q.customerId) where.customerId = Number(q.customerId);
      if (q.projectId) where.projectId = Number(q.projectId);
      const scoped = await applyDataScope(this.prisma, user, where, { ownerFields: ['ownerId', 'createdById'] });

      const [logTotal, logs] = await this.prisma.$transaction([
        this.prisma.crmWorkLog.count({ where: scoped }),
        this.prisma.crmWorkLog.findMany({
          where: scoped,
          include: {
            owner: { select: { id: true, name: true } },
            customer: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
          orderBy: { date: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ], { isolationLevel: 'ReadCommitted' });
      total = logTotal;
      items = logs.map((it: any) => ({ ...it, type: '日志' }));
    } else {
      // 没选时间：返回全部日志（分页）
      const where: any = {};
      if (q.keyword) where.OR = [{ content: { contains: q.keyword } }, { code: { contains: q.keyword } }];
      if (q.ownerId) where.ownerId = Number(q.ownerId);
      if (q.customerId) where.customerId = Number(q.customerId);
      if (q.projectId) where.projectId = Number(q.projectId);
      const scoped = await applyDataScope(this.prisma, user, where, { ownerFields: ['ownerId', 'createdById'] });

      const [logTotal, logs] = await this.prisma.$transaction([
        this.prisma.crmWorkLog.count({ where: scoped }),
        this.prisma.crmWorkLog.findMany({
          where: scoped,
          include: {
            owner: { select: { id: true, name: true } },
            customer: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
          orderBy: { date: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ], { isolationLevel: 'ReadCommitted' });
      total = logTotal;
      items = logs.map((it: any) => ({ ...it, type: '日志' }));
    }

    // 返回：日志 + 客户变更 + 项目变更 + 区间信息
    return {
      total,
      items,
      changedCustomers: {
        total: customerTotal,
        items: changedCustomers.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          owner: c.owner,
          contacts: c.contacts,
          category: c.category,
          type: c.type,
          source: c.source,
          industry: c.industry,
          valueRating: c.valueRating,
          creditLevel: c.creditLevel,
          currencyCode: c.currencyCode,
          address: c.address,
          zipcode: c.zipcode,
          legalPerson: c.legalPerson,
          registeredCapital: c.registeredCapital,
          park: c.park,
          bankName: c.bankName,
          accountName: c.accountName,
          bankAccount: c.bankAccount,
          bankCode: c.bankCode,
          taxId: c.taxId,
          invoiceTitle: c.invoiceTitle,
          invoiceBank: c.invoiceBank,
          invoiceBankAccount: c.invoiceBankAccount,
          paymentDays: c.paymentDays,
          settleDay: c.settleDay,
          attachments: c.attachments,
          followStage: c.followStage,
          createdAt: c.createdAt,
          inheritDate: c.inheritDate,
          submitStatus: c.submitStatus,
        })),
        page: customerPage,
        pageSize: customerPageSize,
      },
      changedProjects: {
        total: projectTotal,
        items: changedProjects.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          owner: p.owner,
          customer: p.customer,
          customerCode: p.customerCode,
          category: p.category,
          stage: p.stage,
          source: p.source,
          state: p.state,
          currencyCode: p.currencyCode,
          expectedRevenue: p.expectedRevenue,
          amountFinal: p.amountFinal,
          plannedCost: p.plannedCost,
          contract: p.contract,
          dateOpen: p.dateOpen,
          lastFollowDate: p.lastFollowDate,
          inheritDate: p.inheritDate,
          submitStatus: p.submitStatus,
        })),
        page: projectPage,
        pageSize: projectPageSize,
      },
      changeRange: {
        start: changeRange.gte?.toISOString().slice(0, 10),
        end: changeRange.lte?.toISOString().slice(0, 10),
      },
      page,
      pageSize,
    };
  }

  async detail(id: number) {
    const w = await this.prisma.crmWorkLog.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
      },
    });
    if (!w) throw new NotFoundException('工作日志不存在');
    return w;
  }

  async create(body: any, user: any) {
    this.logger.info({ userId: user?.id, code: body?.code, customerCode: body?.customerCode }, 'worklog.create start');
    body = sanitize('CrmWorkLog', body);
    const code = body.code || (await this.nextCode());
    const data: any = { ...body, code, createdById: user.id, ownerId: body.ownerId ?? user.id, deptId: user.deptId ?? body.deptId };
    for (const k of ['owner', 'customer', 'project', 'createdBy', 'updatedBy']) delete data[k];
    this.cleanEmpty(data, ['customerId', 'projectId', 'duration', 'deptId', 'ownerId']);
    return this.prisma.crmWorkLog.create({ data });
  }

  async update(id: number, body: any, user: any) {
    body = sanitize('CrmWorkLog', body);
    // ★ CrmWorkLog 模型 schema 里没有 updatedById 字段（CrmCustomer 才有），
    //   之前硬塞 updatedById: user.id 会触发 PrismaClientValidationError。
    //   改为更新 updatedAt 时间戳；后续如需"最后修改人"功能，
    //   应先在 schema.prisma 加 updatedById 字段再 prisma db push。
    const data: any = { ...body, updatedAt: new Date() };
    for (const k of ['owner', 'customer', 'project', 'createdBy', 'updatedBy']) delete data[k];
    this.cleanEmpty(data, ['customerId', 'projectId', 'duration', 'deptId', 'ownerId']);
    return this.prisma.crmWorkLog.update({ where: { id }, data });
  }

  /**
   * 把指定 Int?/Float? 字段的空串 / null 转为 undefined，
   * 避免 Prisma 报 "Invalid value '' for type integer/double precision"。
   */
  private cleanEmpty(obj: any, fields: string[]) {
    if (!obj) return obj;
    for (const f of fields) {
      if (obj[f] === '' || obj[f] === null) obj[f] = undefined;
    }
    return obj;
  }

  async remove(id: number) {
    return this.prisma.crmWorkLog.delete({ where: { id } });
  }

  async searchCustomer(keyword: string, user: any) {
    const where: any = keyword
      ? { OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }] }
      : {};
    const scoped = await applyDataScope(this.prisma, user, where);
    return this.prisma.crmCustomer.findMany({
      where: scoped,
      select: { id: true, code: true, name: true },
      take: 20,
    });
  }

  async searchProject(keyword: string, user: any) {
    const where: any = keyword
      ? { OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }] }
      : {};
    const scoped = await applyDataScope(this.prisma, user, where);
    return this.prisma.crmOpportunity.findMany({
      where: scoped,
      select: { id: true, code: true, name: true },
      take: 20,
    });
  }

  // ============ 本周工作总结（按用户+周唯一） ============
  /**
   * 日期全部统一到 UTC 基准（与 Prisma/Postgres timestamp 行为一致）：
   * - 前端 el-date-picker 发 "YYYY-MM-DD" 字符串，按 ISO 视为 UTC 00:00
   * - startOfWeekUTC / startOfDayUTC 也按 UTC 算周一 00:00 / 当天 00:00
   * 这样保存 / 查询时构造的 Date 对象 getTime() 一致，
   * 否则在中国时区(UTC+8)会出现保存时存了 UTC 00:00，查询时算的是本地 00:00 → 差 16h，
   * 导致 `hasCurrent = false`，占位符永远挡在真实记录前面、内容看起来"保存后不显示"。
   */

  /** 把 "YYYY-MM-DD" 解析为 UTC 00:00（与 startOfWeekUTC / startOfDayUTC 同基准） */
  private parseDateUTC(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /** 取某日期所在 ISO 周的周一 00:00（UTC） */
  private startOfWeekUTC(d: Date): Date {
    const date = new Date(d);
    const day = (date.getUTCDay() + 6) % 7; // 0=周一
    date.setUTCDate(date.getUTCDate() - day);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  async getWeeklySummary(user: any, weekStart?: string) {
    const ws = weekStart ? this.parseDateUTC(weekStart) : this.startOfWeekUTC(new Date());
    const row = await this.prisma.crmWeekSummary.findUnique({
      where: { ownerId_weekStart: { ownerId: user.id, weekStart: ws } },
    });
    if (row) return row;
    return { ownerId: user.id, weekStart: ws, plan: '', content: '', attachments: [] };
  }

  async saveWeeklySummary(user: any, body: any) {
    const ws = body?.weekStart ? this.parseDateUTC(body.weekStart) : this.startOfWeekUTC(new Date());
    // 仅在 attachments 是非空数组时携带，避免向后端 Prisma Json 字段传 [] 引发的兼容性坑
    const data: any = {
      plan: body?.plan ?? '',
      content: body?.content ?? '',
    };
    if (Array.isArray(body?.attachments) && body.attachments.length > 0) {
      data.attachments = body.attachments;
    }
    const existing = await this.prisma.crmWeekSummary.findUnique({
      where: { ownerId_weekStart: { ownerId: user.id, weekStart: ws } },
    });
    if (existing) {
      return this.prisma.crmWeekSummary.update({ where: { id: existing.id }, data });
    }
    return this.prisma.crmWeekSummary.create({ data: { ownerId: user.id, weekStart: ws, ...data } });
  }

  async listWeeklySummaries(
    user: any,
    page = 1,
    pageSize = 10,
    filters: { keyword?: string; ownerId?: number; dateStart?: string; dateEnd?: string } = {},
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Math.min(Number(pageSize) || 10, 52));
    const today = new Date();
    const currentWeekStart = this.startOfWeekUTC(today);

    // 权限兜底：仅 admin 或 leader 可指定 ownerId 筛选任意人；其他人强制 ownerId=自己
    const allowAllUsers = !!user.isAdmin || (user.roleCodes || []).includes('leader');
    const effectiveOwnerId = allowAllUsers
      ? (filters.ownerId || user.id)
      : user.id;

    // 构造 where：ownerId + 可选 keyword（content 模糊）+ 可选 weekStart 日期段
    const where: any = { ownerId: effectiveOwnerId };
    const kw = (filters.keyword || '').trim();
    if (kw) where.content = { contains: kw };
    if (filters.dateStart || filters.dateEnd) {
      where.weekStart = {};
      if (filters.dateStart) where.weekStart.gte = this.parseDateUTC(filters.dateStart);
      if (filters.dateEnd) {
        const end = this.parseDateUTC(filters.dateEnd);
        end.setUTCHours(23, 59, 59, 999);
        where.weekStart.lte = end;
      }
    }

    const total = await this.prisma.crmWeekSummary.count({ where });

    const rows = await this.prisma.crmWeekSummary.findMany({
      where,
      include: { owner: { select: { id: true, name: true, username: true } } },
      orderBy: { weekStart: 'desc' },
      skip: (p - 1) * ps,
      take: ps,
    });

    // ★ 第一页特殊处理：若当前周不在结果中，则在头部补一个空占位，便于新建
    //   占位只在"看自己"+无任何筛选 时才出现，避免干扰其他用户/筛选结果。
    let items: any[] = rows;
    const noFilter =
      effectiveOwnerId === user.id &&
      !kw &&
      !filters.dateStart &&
      !filters.dateEnd;
    if (p === 1 && noFilter) {
      const hasCurrent = rows.some((r: any) => r.weekStart.getTime() === currentWeekStart.getTime());
      const placeholder = hasCurrent
        ? []
        : [{
            ownerId: user.id,
            weekStart: currentWeekStart,
            content: '',
            attachments: [],
            owner: { id: user.id, name: user.name, username: user.username },
          }];
      items = [...placeholder, ...rows].slice(0, ps);
    }

    return {
      total,
      items,
      page: p,
      pageSize: ps,
    };
  }

  async deleteWeeklySummary(user: any, weekStart: string) {
    const ws = this.parseDateUTC(weekStart);
    const existing = await this.prisma.crmWeekSummary.findUnique({
      where: { ownerId_weekStart: { ownerId: user.id, weekStart: ws } },
    });
    if (!existing) throw new NotFoundException('本周总结不存在');
    return this.prisma.crmWeekSummary.delete({ where: { id: existing.id } });
  }

  // ============ 工作日报（按用户+日期唯一） ============

  /** 取某日期的 00:00（UTC） */
  private startOfDayUTC(d: Date): Date {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  async listDailyReports(user: any, limit = 1) {
    const n = Math.max(1, Math.min(Number(limit) || 1, 90));
    const today = this.startOfDayUTC(new Date());

    const rows = await this.prisma.crmDailyReport.findMany({
      where: { ownerId: user.id },
      orderBy: { date: 'desc' },
      take: n,
    });

    const hasToday = rows.some((r: any) => r.date.getTime() === today.getTime());
    const placeholder = hasToday
      ? []
      : [{ ownerId: user.id, date: today, content: '', attachments: [] }];

    return [...placeholder, ...rows].slice(0, n);
  }

  async saveDailyReport(user: any, body: any) {
    const d = body?.date ? this.parseDateUTC(body.date) : this.startOfDayUTC(new Date());
    // 仅在 attachments 是非空数组时携带，避免向后端 Prisma Json 字段传 [] 引发的兼容性坑
    const data: any = {
      content: body?.content ?? '',
    };
    if (Array.isArray(body?.attachments) && body.attachments.length > 0) {
      data.attachments = body.attachments;
    }
    const existing = await this.prisma.crmDailyReport.findUnique({
      where: { ownerId_date: { ownerId: user.id, date: d } },
    });
    if (existing) {
      return this.prisma.crmDailyReport.update({ where: { id: existing.id }, data });
    }
    return this.prisma.crmDailyReport.create({ data: { ownerId: user.id, date: d, ...data } });
  }

  async deleteDailyReport(user: any, date: string) {
    const d = this.parseDateUTC(date);
    const existing = await this.prisma.crmDailyReport.findUnique({
      where: { ownerId_date: { ownerId: user.id, date: d } },
    });
    if (!existing) throw new NotFoundException('工作日报不存在');
    return this.prisma.crmDailyReport.delete({ where: { id: existing.id } });
  }
}
