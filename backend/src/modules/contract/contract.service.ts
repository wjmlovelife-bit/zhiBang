import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitize, cleanArrayFields } from '../../common/utils/payload';
import { applyDataScope } from '../../common/scope';
import { PdfService } from '../../common/pdf/pdf.service';
import { renderPdf } from '../../common/pdf/templates';

@Injectable()
export class ContractService {
  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    @InjectPinoLogger(ContractService.name) private readonly logger: PinoLogger,
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

  async nextCode() {
    // TOCTOU 修复：使用 PG SEQUENCE 原子计数器，并发安全。
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    try {
      const [{ nextval }] = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('public.contract_code_seq') AS nextval
      `;
      return `HT${ymd}${String(Number(nextval)).padStart(4, '0')}`;
    } catch (e) {
      // 兜底：SEQUENCE 不存在时回退到 findFirst 旧逻辑
      const prefix = `HT${ymd}`;
      const last = await this.prisma.salesContract.findFirst({
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

  async list(q: any, user: any) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 1000);
    const where: any = {};
    if (q.keyword) where.OR = [{ title: { contains: q.keyword } }, { customerName: { contains: q.keyword } }, { code: { contains: q.keyword } }];
    if (q.approvalState) where.approvalState = q.approvalState;
    const scoped = await applyDataScope(this.prisma, user, where, { ownerFields: ['createdById'] });
    const [total, items] = await this.prisma.$transaction([
      this.prisma.salesContract.count({ where: scoped }),
      this.prisma.salesContract.findMany({
        where: scoped,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted'});
    return { total, items, page, pageSize };
  }

  async detail(id: number) {
    const c = await this.prisma.salesContract.findUnique({
      where: { id },
      include: { lines: { orderBy: { sort: 'asc' } }, paymentPlans: { orderBy: { seq: 'asc' } } },
    });
    if (!c) throw new NotFoundException('合同不存在');
    return c;
  }

  async create(body: any, user: any) {
    this.logger.info({ userId: user?.id, code: body?.code, title: body?.title }, 'contract.create start');
    body = sanitize('SalesContract', body);
    const { lines, paymentPlans, ...rest } = body;
    const data: any = { ...rest, code: rest.code || (await this.nextCode()), createdById: user.id, deptId: user.deptId ?? rest.deptId };
    for (const k of ['createdBy', 'updatedBy']) delete data[k];
    this.cleanDates(data, ['signDate', 'startDate', 'endDate']);
    cleanArrayFields(data, ['sharedUserIds']);
    if (Array.isArray(lines)) data.lines = { create: lines.map((l: any) => this.cleanDates(this.fixLine(l), ['deliveryDate'])) };
    if (Array.isArray(paymentPlans)) {
      data.paymentPlans = {
        create: paymentPlans.map((p: any) => this.cleanDates(this.stripPlan(p), ['planDate', 'receivedAt'])),
      };
    }
    const created = await this.prisma.salesContract.create({ data, include: { lines: true, paymentPlans: true } });
    this.logger.info({ contractId: created.id, code: created.code }, 'contract.create done');
    return created;
  }

  async update(id: number, body: any, user: any) {
    body = sanitize('SalesContract', body);
    const { lines, paymentPlans, ...rest } = body;
    const data: any = { ...rest };
    for (const k of ['createdBy', 'updatedBy']) delete data[k];
    this.cleanDates(data, ['signDate', 'startDate', 'endDate']);
    cleanArrayFields(data, ['sharedUserIds']);
    return this.prisma.$transaction(async (tx) => {
      if (Array.isArray(lines)) {
        await tx.salesContractLine.deleteMany({ where: { contractId: id } });
        data.lines = { create: lines.map((l: any) => this.cleanDates(this.fixLine(l), ['deliveryDate'])) };
      }
      if (Array.isArray(paymentPlans)) {
        await tx.salesContractPaymentPlan.deleteMany({ where: { contractId: id } });
        data.paymentPlans = {
          create: paymentPlans.map((p: any) => this.cleanDates(this.stripPlan(p), ['planDate', 'receivedAt'])),
        };
      }
      return tx.salesContract.update({ where: { id }, data, include: { lines: true, paymentPlans: true } });
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 });
  }

  // 剥离子行自增 id / 外键 / 时间戳，避免 Prisma create 报 "Unknown argument id"
  private stripPlan(p: any) {
    const { id, contractId, createdAt, updatedAt, ...rest } = p;
    return rest;
  }

  /**
   * 把指定 DateTime 字段的空串/null 转为 undefined，避免 Prisma 报
   * "Invalid value '' for type 'timestamp'"（前端 el-date-picker 未填时回填 ''）。
   */
  private cleanDates(obj: any, dateFields: string[]) {
    if (!obj) return obj;
    for (const f of dateFields) {
      if (obj[f] === '' || obj[f] === null) obj[f] = undefined;
    }
    return obj;
  }

  // 明细行必填 Decimal 字段（priceIncludeTax/moneyAfterTax/pricejy 等）前端不传，给默认值避免 500
  private fixLine(l: any) {
    // 剥离子行自增 id / 外键 / 时间戳，避免 Prisma create 报 "Unknown argument id"
    const { id, contractId, createdAt, updatedAt, ...rest } = l;
    return {
      ...rest,
      discount: rest.discount ?? 0,
      priceIncludeTax: rest.priceIncludeTax ?? 0,
      taxRate: rest.taxRate ?? 0,
      moneyAfterTax: rest.moneyAfterTax ?? 0,
      pricejy: rest.pricejy ?? 0,
      amount: rest.amount ?? 0,
    };
  }

  async remove(id: number) {
    return this.prisma.salesContract.delete({ where: { id } });
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
    const c = await this.detail(id);
    let total = 0;
    const lines = (c.lines || []).map((l: any) => {
      total += Number(l.amount) || 0;
      return {
        productName: l.productName || '',
        quantity: l.quantity ?? '',
        unitPrice: this.fmtMoney(l.unitPrice),
        discount: l.discount ?? '',
        taxRate: l.taxRate ?? '',
        amount: this.fmtMoney(l.amount),
      };
    });
    const plans = (c.paymentPlans || []).map((p: any) => ({
      seq: p.seq ?? '',
      planDate: this.fmtDate(p.planDate),
      amount: this.fmtMoney(p.amount),
      remark: p.remark || '',
    }));
    const data = {
      companyName: await this.getCompanyName(),
      docTitle: '销售合同',
      now: this.fmtDate(new Date()),
      code: c.code || '',
      title: c.title || '',
      customerName: c.customerName || '',
      ownerName: c.ownerName || '',
      signPlace: c.signPlace || '',
      currencyCode: c.currencyCode || '',
      brand: c.brand || '',
      signDate: this.fmtDate(c.signDate),
      paybackMode: c.paybackMode || '',
      startDate: this.fmtDate(c.startDate),
      endDate: this.fmtDate(c.endDate),
      intro: c.intro || '',
      lines,
      amountTotal: this.fmtMoney(c.amountTotal ?? total),
      plans,
    };
    const html = renderPdf('contract', data);
    return this.pdf.htmlToPdf(html);
  }
}
