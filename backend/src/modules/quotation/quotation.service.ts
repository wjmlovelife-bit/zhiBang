import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitize } from '../../common/utils/payload';
import { applyDataScope } from '../../common/scope';
import { PdfService } from '../../common/pdf/pdf.service';
import { renderPdf } from '../../common/pdf/templates';

@Injectable()
export class QuotationService {
  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    @InjectPinoLogger(QuotationService.name) private readonly logger: PinoLogger,
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
        SELECT nextval('public.quotation_code_seq') AS nextval
      `;
      return `BJ${ymd}${String(Number(nextval)).padStart(4, '0')}`;
    } catch (e) {
      // 兜底：SEQUENCE 不存在时回退到 findFirst 旧逻辑
      const prefix = `BJ${ymd}`;
      const last = await this.prisma.salesQuotation.findFirst({
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
      this.prisma.salesQuotation.count({ where: scoped }),
      this.prisma.salesQuotation.findMany({
        where: scoped,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ], { isolationLevel: 'ReadCommitted'});
    return { total, items, page, pageSize };
  }

  async detail(id: number) {
    const q = await this.prisma.salesQuotation.findUnique({
      where: { id },
      include: { lines: { orderBy: { sort: 'asc' } } },
    });
    if (!q) throw new NotFoundException('报价单不存在');
    return q;
  }

  async create(body: any, user: any) {
    this.logger.info({ userId: user?.id, code: body?.code }, 'quotation.create start');
    body = sanitize('SalesQuotation', body);
    const { lines, ...rest } = body;
    const data: any = { ...rest, code: rest.code || (await this.nextCode()), createdById: user.id, deptId: user.deptId ?? rest.deptId };
    for (const k of ['createdBy', 'updatedBy']) delete data[k];
    if (Array.isArray(lines)) data.lines = { create: lines.map((l: any) => this.fixLine(l)) };
    const created = await this.prisma.salesQuotation.create({ data, include: { lines: true } });
    this.logger.info({ quotationId: created.id, code: created.code }, 'quotation.create done');
    return created;
  }

  async update(id: number, body: any, user: any) {
    body = sanitize('SalesQuotation', body);
    const { lines, ...rest } = body;
    const data: any = { ...rest };
    for (const k of ['createdBy', 'updatedBy']) delete data[k];
    if (Array.isArray(lines)) {
      await this.prisma.salesQuotationLine.deleteMany({ where: { quotationId: id } });
      data.lines = { create: lines.map((l: any) => this.fixLine(l)) };
    }
    return this.prisma.salesQuotation.update({ where: { id }, data, include: { lines: true } });
  }

  // 明细行必填的 Decimal 字段（priceIncludeTax/moneyBeforeTax/pricejy 等）前端不传，给默认值避免 500
  private fixLine(l: any) {
    // 剥离子行自增 id / 外键 / 时间戳，避免 Prisma create 报 "Unknown argument id"
    const { id, quotationId, createdAt, updatedAt, ...rest } = l;
    return {
      ...rest,
      discount: rest.discount ?? 0,
      priceIncludeTax: rest.priceIncludeTax ?? 0,
      taxRate: rest.taxRate ?? 0,
      moneyBeforeTax: rest.moneyBeforeTax ?? 0,
      pricejy: rest.pricejy ?? 0,
      amount: rest.amount ?? 0,
    };
  }

  async remove(id: number) {
    return this.prisma.salesQuotation.delete({ where: { id } });
  }

  async searchCustomer(keyword: string) {
    const where: any = keyword
      ? { OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }] }
      : {};
    return this.prisma.crmCustomer.findMany({
      where,
      select: { id: true, code: true, name: true },
      take: 20,
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
    const q = await this.detail(id);
    let total = 0;
    const lines = (q.lines || []).map((l: any) => {
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
    const data = {
      companyName: await this.getCompanyName(),
      docTitle: '报价单',
      now: this.fmtDate(new Date()),
      code: q.code || '',
      title: q.title || '',
      customerName: q.customerName || '',
      contactName: q.contactName || '',
      date: this.fmtDate(q.date ?? q.createdAt),
      currencyCode: q.currencyCode || '',
      opportunityCode: q.opportunityCode || '',
      intro: q.intro || '',
      lines,
      amountTotal: this.fmtMoney(total),
    };
    const html = renderPdf('quotation', data);
    return this.pdf.htmlToPdf(html);
  }
}
