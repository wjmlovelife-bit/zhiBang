import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

export interface SalesSummaryQuery {
  /** 销售员 id（为空=全员汇总） */
  userId?: number;
  /** ISO 日期 'YYYY-MM-DD'（可选） */
  dateFrom?: string;
  /** ISO 日期 'YYYY-MM-DD'（可选） */
  dateTo?: string;
}

export interface SalesSummaryRow {
  userId: number | null;
  username: string;
  name: string;
  deptName: string;
  /** 时间范围内新增的客户数 */
  newCustomers: number;
  /** 时间范围内新增的项目数 */
  newProjects: number;
  /** 该人名下客户总数（不受时间范围影响） */
  customerCount: number;
  /** 该人名下项目总数（不受时间范围影响） */
  projectCount: number;
}

export interface SalesSummaryResult {
  total: {
    newCustomers: number;
    newProjects: number;
    customerCount: number;
    projectCount: number;
  };
  perUser: SalesSummaryRow[];
}

/**
 * 销售数据统计服务
 * - 时间字段以 createdAt 为准（DB 写入时间）
 * - dateFrom/dateTo 为空则不过滤时间
 * - userId 为空则按 ownerId 分组 + 全员合计
 */
@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(StatsService.name) private readonly logger: PinoLogger,
  ) {}

  async summary(q: SalesSummaryQuery): Promise<SalesSummaryResult> {
    this.logger.info(
      { userId: q.userId, dateFrom: q.dateFrom, dateTo: q.dateTo },
      'salesSummary start',
    );
    const dateFilter = this.buildDateFilter(q.dateFrom, q.dateTo);
    const whereUser = q.userId ? { ownerId: q.userId } : {};

    // 1) 全员汇总（不受 userId 影响：查总客户/总项目数）
    const totalCustomers = await this.prisma.crmCustomer.count();
    const totalProjects = await this.prisma.crmOpportunity.count();

    // 2) 时间范围内新增的客户/项目
    const newCustomersInRange = await this.prisma.crmCustomer.count({
      where: { ...(dateFilter.customer || {}), ...whereUser },
    });
    const newProjectsInRange = await this.prisma.crmOpportunity.count({
      where: { ...(dateFilter.opportunity || {}), ...whereUser },
    });

    // 3) 人员维度（按 ownerId 分组；userId 指定时只查一人）
    // 步骤：先查 user 列表（id, name, dept），再 group by ownerId 聚合
    const users = await this.prisma.sysUser.findMany({
      where: q.userId ? { id: q.userId, isActive: true } : { isActive: true },
      select: {
        id: true,
        username: true,
        name: true,
        dept: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    const perUser: SalesSummaryRow[] = [];
    for (const u of users) {
      // 跳过没有任何客户/项目关联的非销售员，避免表里全是 0 的噪音
      const [newC, newP, cCount, pCount] = await Promise.all([
        this.prisma.crmCustomer.count({
          where: { ownerId: u.id, ...(dateFilter.customer || {}) },
        }),
        this.prisma.crmOpportunity.count({
          where: { ownerId: u.id, ...(dateFilter.opportunity || {}) },
        }),
        this.prisma.crmCustomer.count({ where: { ownerId: u.id } }),
        this.prisma.crmOpportunity.count({ where: { ownerId: u.id } }),
      ]);
      // 过滤掉完全 0 0 的行（无任何客户/项目的人）
      if (newC === 0 && newP === 0 && cCount === 0 && pCount === 0) continue;
      perUser.push({
        userId: u.id,
        username: u.username,
        name: u.name,
        deptName: u.dept?.name || '-',
        newCustomers: newC,
        newProjects: newP,
        customerCount: cCount,
        projectCount: pCount,
      });
    }
    // 按新增客户倒序，再按新增项目倒序
    perUser.sort((a, b) => b.newCustomers - a.newCustomers || b.newProjects - a.newProjects);

    const result = {
      total: {
        newCustomers: newCustomersInRange,
        newProjects: newProjectsInRange,
        customerCount: totalCustomers,
        projectCount: totalProjects,
      },
      perUser,
    };
    this.logger.info(
      {
        userId: q.userId,
        newCustomers: result.total.newCustomers,
        newProjects: result.total.newProjects,
        perUserCount: result.perUser.length,
      },
      'salesSummary done',
    );
    return result;
  }

  /**
   * 构建 Excel 工作簿
   * - 第 1 行：标题 + 时间筛选条件
   * - 第 2 行：表头（人员/部门/新增客户/新增项目/客户累计/项目累计）
   * - 后续：人员明细（行 = perUser）
   * - 最后一行：合计
   */
  async buildExcel(q: SalesSummaryQuery): Promise<Buffer> {
    this.logger.info(
      { userId: q.userId, dateFrom: q.dateFrom, dateTo: q.dateTo },
      'salesExport start',
    );
    const data = await this.summary(q);
    const rows: any[][] = [];
    const cond: string[] = ['全部数据'];
    if (q.userId) cond.push(`人员 ID=${q.userId}`);
    if (q.dateFrom) cond.push(`起始=${q.dateFrom}`);
    if (q.dateTo) cond.push(`结束=${q.dateTo}`);
    rows.push(['销售数据统计（' + cond.join(' / ') + '）']);
    rows.push(['人员', '部门', '新增客户', '新增项目', '客户累计', '项目累计']);
    for (const r of data.perUser) {
      rows.push([
        `${r.name}（${r.username}）`,
        r.deptName,
        r.newCustomers,
        r.newProjects,
        r.customerCount,
        r.projectCount,
      ]);
    }
    rows.push([
      '合计',
      '-',
      data.total.newCustomers,
      data.total.newProjects,
      data.total.customerCount,
      data.total.projectCount,
    ]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // 合并标题行（A1:F1）
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    ws['!cols'] = [
      { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '销售数据统计');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    this.logger.info({ userId: q.userId, bufferLen: buf.length }, 'salesExport done');
    return buf;
  }

  /**
   * 日期范围 filter：dateFrom/dateTo 都为空 → 返回空对象（不过滤）
   * 注意：createdAt 字段，CrmCustomer 和 CrmOpportunity 都有
   */
  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
  ): { customer?: any; opportunity?: any } {
    if (!dateFrom && !dateTo) return {};
    const gte = dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {};
    const lte = dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {};
    const createdAt = { ...gte, ...lte };
    return { customer: { createdAt }, opportunity: { createdAt } };
  }
}