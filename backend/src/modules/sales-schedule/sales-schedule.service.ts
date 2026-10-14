import { Injectable, BadRequestException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';

const WEEKDAY_LABELS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

/**
 * 销售日程管理（sales-schedule）
 * - 顶部 3 段（计划/总结/评定）由销售自己填写 → CrmSalesSchedule 表
 * - 第 3-8 列（日程/客户/项目/联系人/里程碑/跟进情况）实时从 CrmCustomerFollow + CrmProjectFollow 聚合
 *
 * 表格列结构（6 列）：
 *   1 时间范围 (rowspan=18)
 *   2 字段/日期/上下午
 *   3 日程
 *   4 客户
 *   5 项目
 *   6 联系人
 *   7 里程碑
 *   8 跟进情况
 *
 * 行结构（18 行）：
 *   1 本周工作计划
 *   2 本周工作总结
 *   3 领导评定
 *   4 表头
 *   5-18 7 天 × 2 行（上午/下午）
 */
@Injectable()
export class SalesScheduleService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(SalesScheduleService.name) private readonly logger: PinoLogger,
  ) {}

  // 计算一周范围（周一00:00 ~ 周日23:59:59.999Z）
  private weekRange(weekStart: Date): { start: Date; end: Date } {
    const start = new Date(weekStart);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  // 按 followDate 转字符串 YYYY-MM-DD（与日历字段比较用）
  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // 把字符串 period 标准化为 'am' | 'pm' | null（null 表示仅日期，默认排到上午）
  private normalizePeriod(p: any): 'am' | 'pm' | null {
    return p === 'am' || p === 'pm' ? p : null;
  }

  // 把 follow 中的 contactName (字符串 '; 拼接') 拆成数组
  private splitContactName(s: string | null | undefined): string[] {
    if (!s) return [];
    return s.split(';').map((x) => x.trim()).filter(Boolean);
  }

  /**
   * 聚合某周某 owner 的所有 follow → 二维数组 dayCells[7][2]（am/pm）
   * 每个 cell = { schedule, customer, project, contactNames, milestone, content }
   */
  private async aggregateWeek(ownerId: number, weekStart: Date) {
    const { start, end } = this.weekRange(weekStart);
    // 拉该 owner 的客户跟进 + 项目跟进（含关联）
    const [customerFollows, projectFollows] = await Promise.all([
      this.prisma.crmCustomerFollow.findMany({
        where: { followerId: ownerId, followDate: { gte: start, lte: end } },
        include: { customer: { select: { id: true, code: true, name: true } } },
        orderBy: [{ followDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.crmProjectFollow.findMany({
        where: { followerId: ownerId, followDate: { gte: start, lte: end } },
        include: {
          project: {
            select: {
              id: true, code: true, name: true, stage: true,
              customer: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ followDate: 'asc' }, { id: 'asc' }],
      }),
    ]);

    // dayCells[7][2] = am/pm 数组
    const dayCells: Array<{
      am: any[];
      pm: any[];
    }> = Array.from({ length: 7 }, () => ({ am: [], pm: [] }));

    const pushCell = (dateIdx: number, period: 'am' | 'pm', cell: any) => {
      dayCells[dateIdx][period].push(cell);
    };

    for (const f of customerFollows) {
      const d = new Date(f.followDate);
      const dateIdx = Math.min(6, Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000)));
      const period = this.normalizePeriod(f.period) || 'am';
      pushCell(dateIdx, period, {
        schedule: f.schedule || '',
        customer: f.customer?.name || '',
        customerCode: f.customer?.code || '',
        customerId: f.customer?.id ?? null,
        project: '',
        projectCode: '',
        projectId: null,
        contactNames: this.splitContactName(f.contactName),
        milestone: '',
        content: f.content || '',
        followDate: this.ymd(d),
        followType: 'customer',
      });
    }

    for (const f of projectFollows) {
      const d = new Date(f.followDate);
      const dateIdx = Math.min(6, Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000)));
      const period = this.normalizePeriod(f.period) || 'am';
      pushCell(dateIdx, period, {
        schedule: f.schedule || '',
        customer: f.project?.customer?.name || '',
        customerCode: f.project?.customer?.code || '',
        customerId: f.project?.customer?.id ?? null,
        project: f.project?.name || '',
        projectCode: f.project?.code || '',
        projectId: f.project?.id ?? null,
        contactNames: this.splitContactName(f.contactName),
        milestone: f.project?.stage || '',
        content: f.content || '',
        followDate: this.ymd(d),
        followType: 'project',
      });
    }

    return dayCells;
  }

  /**
   * 拉某周某 owner 的页面数据：
   * { weekStart, weekEnd, planText, summaryText, leaderComment, days: [{date, am:[...], pm:[...]}], users:[人员下拉] }
   */
  async getByWeek(ownerId: number, weekStart: Date) {
    const row = await this.prisma.crmSalesSchedule.findUnique({
      where: { ownerId_weekStart: { ownerId, weekStart } },
    });
    const { start, end } = this.weekRange(weekStart);
    // R17 3.2：优先返回 daysSnapshot（销售 upsert 时冻结的快照）；无则实时聚合
    // 注: daysSnapshot 字段类型用 (row as any) 绕过（Prisma Client 类型生成在重启后更新）
    const snap = (row as any)?.daysSnapshot;
    const fromSnapshot = Array.isArray(snap) && snap.length > 0;
    const days = fromSnapshot
      ? snap
      : await this.buildDaysArray(ownerId, weekStart, start);
    this.logger.info(
      {
        ownerId,
        weekStart: start.toISOString().slice(0, 10),
        source: fromSnapshot ? 'snapshot' : 'aggregate',
        daysCount: days.length,
        followCount: days.reduce((s, d) => s + (d.am?.length || 0) + (d.pm?.length || 0), 0),
      },
      'sales-schedule get done',
    );
    return {
      ownerId,
      weekStart: start,
      weekEnd: end,
      planText: row?.planText || '',
      summaryText: row?.summaryText || '',
      leaderComment: row?.leaderComment || '',
      days,
    };
  }

  /**
   * 实时聚合 days（7 天 × am/pm 二维数组）—— getByWeek 在没有 snapshot 时用
   */
  private async buildDaysArray(ownerId: number, weekStart: Date, start: Date): Promise<any[]> {
    const dayCells = await this.aggregateWeek(ownerId, weekStart);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      days.push({
        date: this.ymd(d),
        dateLabel: `${d.getUTCDate()}日 ${WEEKDAY_LABELS[i]}`,
        daySummary: '', // 当日总结（用户手动输入；upsert 时回填）
        am: dayCells[i].am,
        pm: dayCells[i].pm,
      });
    }
    return days;
  }

  /**
   * upsert 顶部 3 段可编辑内容
   */
  async upsert(body: any) {
    const ownerId = Number(body.ownerId);
    const weekStart = body.weekStart instanceof Date
      ? body.weekStart
      : new Date(body.weekStart);
    if (!ownerId || isNaN(weekStart.getTime())) {
      throw new BadRequestException('ownerId / weekStart 必填');
    }
    // R17 3.2：upsert 时冻结当时聚合快照，避免后续 follow 被改/删影响历史
    //    注: daysSnapshot 字段类型用 (data as any) 绕过（Prisma Client 类型生成在重启后更新）
    const { start } = this.weekRange(weekStart);
    const daysSnapshot = await this.buildDaysArray(ownerId, weekStart, start);
    // R37：当日总结（daySummary）由前端用户输入，body.days[i].daySummary 覆盖 buildDaysArray 默认值
    if (Array.isArray(body.days)) {
      const byDate = new Map(daysSnapshot.map((d) => [d.date, d]));
      for (const bd of body.days) {
        const target = byDate.get(bd.date);
        if (target && typeof bd.daySummary === 'string') {
          target.daySummary = bd.daySummary;
        }
      }
    }
    const data: any = {
      planText: body.planText ?? null,
      summaryText: body.summaryText ?? null,
      leaderComment: body.leaderComment ?? null,
      daysSnapshot,
    };
    const result = await this.prisma.crmSalesSchedule.upsert({
      where: { ownerId_weekStart: { ownerId, weekStart } },
      create: { ownerId, weekStart, ...data },
      update: data,
    });
    const followCount = daysSnapshot.reduce(
      (s: number, d: any) => s + (d.am?.length || 0) + (d.pm?.length || 0),
      0,
    );
    this.logger.info(
      {
        ownerId,
        weekStart: start.toISOString().slice(0, 10),
        followCount,
        daysCount: daysSnapshot.length,
      },
      'sales-schedule upsert done (snapshot saved)',
    );
    return result;
  }

  /**
   * 导出某周某 owner 的全部内容为 xlsx Buffer
   * 9 列 × N 行（含合并单元格 + 当日总结列）
   */
  async exportToBuffer(ownerId: number, weekStart: Date): Promise<Buffer> {
    this.logger.info({ ownerId, weekStart: weekStart.toISOString().slice(0, 10) }, 'sales-schedule export start');
    const data = await this.getByWeek(ownerId, weekStart);
    const start = new Date(data.weekStart);
    const end = new Date(data.weekEnd);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
    const rangeText = `${fmt(start)} ~ ${fmt(end)}`;

    // 9 列 × N 行（follow 数不定）。每行固定：1 时间/字段 + 1 上下午 + 7 内容
    // 顶部 3 段 + 表头行 + 数据行
    const aoa: any[][] = [];
    aoa.push([rangeText, '本周工作计划', '', '', '', '', '', data.planText || '']);
    aoa.push(['',         '本周工作总结', '', '', '', '', '', data.summaryText || '']);
    aoa.push(['',         '领导评定',    '', '', '', '', '', data.leaderComment || '']);
    aoa.push(['',         '日期',         '上下午', '当日总结', '日程', '客户', '项目', '联系人', '里程碑', '跟进情况']);

    for (const d of data.days) {
      const daySummary = d.daySummary || '';
      const expand = (slot: 'am' | 'pm') => {
        const cells = (slot === 'am' ? d.am : d.pm) || [];
        if (cells.length === 0) {
          aoa.push(['', d.dateLabel, slot === 'am' ? '上午' : '下午', daySummary, '', '', '', '', '', '']);
          return;
        }
        for (const c of cells) {
          aoa.push([
            '',
            d.dateLabel,
            slot === 'am' ? '上午' : '下午',
            daySummary,
            c.schedule || '',
            c.customer || '',
            c.project || '',
            (c.contactNames || []).join('; '),
            c.milestone || '',
            c.content || '',
          ]);
        }
      };
      expand('am');
      expand('pm');
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const merges: XLSX.Range[] = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 0 } }); // 时间范围跨整列
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 6 } }); // 本周工作计划
    merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 6 } }); // 本周工作总结
    merges.push({ s: { r: 2, c: 1 }, e: { r: 2, c: 6 } }); // 领导评定
    // 同日期合并（跨上下两行内所有 follow 单元格 + 当日总结也跨该日）
    let curRow = 4;
    for (const d of data.days) {
      const amCount = (d.am || []).length || 1;
      const pmCount = (d.pm || []).length || 1;
      const total = amCount + pmCount;
      // 日期列 B 跨该日所有 follow 行
      merges.push({ s: { r: curRow, c: 1 }, e: { r: curRow + total - 1, c: 1 } });
      // 当日总结列 C 也跨该日所有 follow 行
      merges.push({ s: { r: curRow, c: 2 }, e: { r: curRow + total - 1, c: 2 } });
      curRow += total;
    }
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 22 }, // 时间范围
      { wch: 14 }, // 字段/日期
      { wch: 8 },  // 上下午
      { wch: 22 }, // 当日总结
      { wch: 18 }, // 日程
      { wch: 22 }, // 客户
      { wch: 22 }, // 项目
      { wch: 18 }, // 联系人
      { wch: 14 }, // 里程碑
      { wch: 36 }, // 跟进情况
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '销售日程');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}