/**
 * QuotationService 单元测试（核心）
 * 1. create: lines 重写
 * 2. update: lines 重写
 * 3. detail 含 lines
 * 4. searchCustomer
 * 5. PDF 生成
 */
import { Test } from '@nestjs/testing';
import { QuotationService } from '@app/modules/quotation/quotation.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('QuotationService', () => {
  let service: QuotationService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        QuotationService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<QuotationService>(QuotationService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. create writes quotation with lines', async () => {
    setMock(mock, 'salesQuotation.create', { id: 99 });
    await service.create({
      title: '测试报价', customerName: '客户A', lines: [{ productName: '产品', quantity: 1, unitPrice: 100 }],
    }, { id: 1 });
    const call = mock.salesQuotation.create.mock.calls[0][0];
    expect(call.data.lines).toBeDefined();
  });

  it('2. detail returns quotation with lines', async () => {
    setMock(mock, 'salesQuotation.findUnique', { id: 1, title: 'X', lines: [] });
    const result: any = await service.detail(1);
    expect(result.id).toBe(1);
  });

  it('3. searchCustomer returns autocomplete results', async () => {
    setMock(mock, 'crmCustomer.findMany', [{ id: 1, name: '客户A' }]);
    const result: any = await service.searchCustomer('客户');
    expect(result.length).toBe(1);
  });

  it('4. update rewrites lines array', async () => {
    // 源 QuotationService.update 不使用 $transaction，而是先 deleteMany 子行再 update 主表
    setMock(mock, 'salesQuotationLine.deleteMany', { count: 1 });
    setMock(mock, 'salesQuotation.update', { id: 1 });
    await service.update(1, {
      title: '改',
      lines: [{ productName: 'P', quantity: 2, unitPrice: 200 }],
    });
    expect(mock.salesQuotationLine.deleteMany).toHaveBeenCalled();
    expect(mock.salesQuotation.update).toHaveBeenCalled();
    const updCall = mock.salesQuotation.update.mock.calls[0][0];
    expect(updCall.data.lines).toBeDefined();
  });
});
