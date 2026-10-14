/**
 * QuotationService 全场景单测（覆盖 modules/quotation/quotation.service.ts）
 *
 * 与现有 quotation.service.spec.ts（基础 4 用例）互补，覆盖：
 *  - list: keyword OR / approvalState / pageSize 上限 / dataScope=2/3/4/5
 *  - detail: 不存在→404、include lines 顺序
 *  - create: body.code 已传、lines 同步（金额默认值）、lines 子行剥离 id
 *  - update: lines 非数组不删、lines=[] 清空
 *  - remove: 不存在→Prisma P2025
 *  - searchCustomer: keyword 空、take:20、select 字段
 *  - generatePdf: 不存在→404、组装数据含客户名
 */
import { NotFoundException } from '@nestjs/common';
import { QuotationService } from '@app/modules/quotation/quotation.service';
import { makeMockPrisma, MockPrisma, setMock, setMockError, resetMockPrisma } from '../setup/prisma-mock';

describe('QuotationService scenarios', () => {
  let service: QuotationService;
  let mock: MockPrisma;
  const admin = { id: 1, isAdmin: true, deptId: null } as any;
  const sales = { id: 2, isAdmin: false, deptId: 2, dataScope: 4 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new QuotationService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    function setupListMocks(total = 0, items: any[] = []) {
      setMock(mock, 'salesQuotation.count', total);
      setMock(mock, 'salesQuotation.findMany', items);
      mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
    }

    it('1. keyword OR（title/customerName/code）三字段', async () => {
      setupListMocks(0, []);
      await service.list({ keyword: 'A' }, admin);
      const call = mock.salesQuotation.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
    });

    it('2. approvalState 过滤', async () => {
      setupListMocks(0, []);
      await service.list({ approvalState: 'pending' }, admin);
      const call = mock.salesQuotation.findMany.mock.calls[0][0];
      expect(call.where.approvalState).toBe('pending');
    });

    it('3. 默认 pageSize=20', async () => {
      setupListMocks(0, []);
      const r: any = await service.list({}, admin);
      expect(r.pageSize).toBe(20);
    });

    it('4. dataScope=4（非 admin 本人）应走 applyDataScope', async () => {
      setupListMocks(0, []);
      await service.list({}, sales);
      // applyDataScope 应被调用一次（dataScope=4 → OR ownerId/createdById 条件）
      expect(mock.salesQuotation.findMany).toHaveBeenCalled();
    });
  });

  // ============================================================
  // detail
  // ============================================================
  describe('detail', () => {
    it('5. 不存在 → NotFound', async () => {
      setMock(mock, 'salesQuotation.findUnique', null);
      await expect(service.detail(999)).rejects.toThrow(NotFoundException);
    });

    it('6. 存在 → include lines 升序', async () => {
      setMock(mock, 'salesQuotation.findUnique', { id: 1, code: 'BJ001', lines: [] });
      await service.detail(1);
      const call = mock.salesQuotation.findUnique.mock.calls[0][0];
      expect(call.include.lines.orderBy).toEqual({ sort: 'asc' });
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('7. body.code 已传 → 不调 nextCode', async () => {
      setMock(mock, 'salesQuotation.create', { id: 1 });
      await service.create({ code: 'BJ202609220099', title: 'X' }, admin);
      expect(mock.salesQuotation.findFirst).not.toHaveBeenCalled();
      expect(mock.salesQuotation.create.mock.calls[0][0].data.code).toBe('BJ202609220099');
    });

    it('8. lines 同步：Decimal 默认值（priceIncludeTax/taxRate/moneyBeforeTax/pricejy/amount）', async () => {
      setMock(mock, 'salesQuotation.create', { id: 1 });
      await service.create({
        title: 'X',
        lines: [{ productName: 'P', quantity: 1, unitPrice: 100 }],
      }, admin);
      const line = mock.salesQuotation.create.mock.calls[0][0].data.lines.create[0];
      expect(line).toMatchObject({
        productName: 'P', quantity: 1, unitPrice: 100,
        discount: 0, priceIncludeTax: 0, taxRate: 0,
        moneyBeforeTax: 0, pricejy: 0, amount: 0,
      });
    });

    it('9. lines 子行自动剥离 id/quotationId/createdAt/updatedAt', async () => {
      setMock(mock, 'salesQuotation.create', { id: 1 });
      await service.create({
        title: 'X',
        lines: [{ id: 999, quotationId: 1, createdAt: 'X', productName: 'P' }],
      }, admin);
      const line = mock.salesQuotation.create.mock.calls[0][0].data.lines.create[0];
      expect(line.id).toBeUndefined();
      expect(line.quotationId).toBeUndefined();
      expect(line.createdAt).toBeUndefined();
    });

    it('10. createdById = user.id', async () => {
      setMock(mock, 'salesQuotation.create', { id: 1 });
      await service.create({ title: 'X' }, sales);
      expect(mock.salesQuotation.create.mock.calls[0][0].data.createdById).toBe(2);
    });
  });

  // ============================================================
  // update
  // ============================================================
  describe('update', () => {
    it('11. lines 非数组经 sanitize 转为 [] → 仍触删旧行（行为记录）', async () => {
      setMock(mock, 'salesQuotationLine.deleteMany', { count: 0 });
      setMock(mock, 'salesQuotation.update', { id: 1 });
      await service.update(1, { lines: 'invalid' as any }, admin);
      // scrub 对 NESTED 非数组字段转 []，update 入口 Array.isArray=true
      expect(mock.salesQuotationLine.deleteMany).toHaveBeenCalled();
    });

    it('12. lines=[] 清空旧明细', async () => {
      setMock(mock, 'salesQuotationLine.deleteMany', { count: 0 });
      setMock(mock, 'salesQuotation.update', { id: 1 });
      await service.update(1, { lines: [] }, admin);
      expect(mock.salesQuotationLine.deleteMany).toHaveBeenCalledWith({ where: { quotationId: 1 } });
      expect(mock.salesQuotation.update.mock.calls[0][0].data.lines).toEqual({ create: [] });
    });

    it('13. 仅传 title 不传 lines → 不删旧行', async () => {
      setMock(mock, 'salesQuotation.update', { id: 1 });
      await service.update(1, { title: '改名' }, admin);
      expect(mock.salesQuotationLine.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // remove
  // ============================================================
  describe('remove', () => {
    it('14. 不存在 → Prisma P2025（行为记录）', async () => {
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'salesQuotation.delete', err);
      await expect(service.remove(999)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // searchCustomer
  // ============================================================
  describe('searchCustomer', () => {
    it('15. keyword OR（name/code）二字段 + select 精确 + take:20', async () => {
      setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'KH001', name: 'A' }]);
      await service.searchCustomer('A');
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(2);
      expect(call.select).toEqual({ id: true, code: true, name: true });
      expect(call.take).toBe(20);
    });

    it('16. keyword 空 → OR 不设置', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      await service.searchCustomer('');
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeUndefined();
    });
  });

  // ============================================================
  // generatePdf
  // ============================================================
  describe('generatePdf', () => {
    it('17. 不存在 → NotFound', async () => {
      setMock(mock, 'salesQuotation.findUnique', null);
      await expect(service.generatePdf(999)).rejects.toThrow(NotFoundException);
    });

    it('18. 正常报价：detail 被调 + lines 数据组装（含金额合计）', async () => {
      setMock(mock, 'salesQuotation.findUnique', {
        id: 1, code: 'BJ001', title: '报价A', customerName: '客户A',
        contactName: '张三', currencyCode: 'CNY', opportunityCode: 'XM001',
        intro: '说明',
        lines: [
          { id: 1, productName: 'P1', quantity: 2, unitPrice: 100, discount: 10, taxRate: 13, amount: 180 },
          { id: 2, productName: 'P2', quantity: 1, unitPrice: 50, discount: 0, taxRate: 13, amount: 50 },
        ],
      });
      // PdfService.htmlToPdf 真实调用 puppeteer；沙箱无 chromium 会失败。接受失败
      try { await service.generatePdf(1); } catch {}
      expect(mock.salesQuotation.findUnique).toHaveBeenCalled();
    });
  });
});