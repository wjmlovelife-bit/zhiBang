/**
 * ContractService 单元测试（核心）
 * 1. create with lines + paymentPlans
 * 2. detail 含完整关联
 * 3. update 重写 lines 和 paymentPlans
 * 4. nextCode 生成编码
 */
import { Test } from '@nestjs/testing';
import { ContractService } from '@app/modules/contract/contract.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('ContractService', () => {
  let service: ContractService;
  let mock: MockPrisma;
  // 源 ContractService.create(body, user) 读取 user.id / user.deptId，必须传 user
  const user = { id: 1, isAdmin: true, deptId: null } as any;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<ContractService>(ContractService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. create with lines and paymentPlans', async () => {
    setMock(mock, 'salesContract.create', { id: 99 });
    await service.create({
      title: '测试合同', customerName: '客户A', signDate: '2026-09-21',
      lines: [{ productName: 'P', quantity: 1, unitPrice: 100 }],
      paymentPlans: [{ seq: 1, planDate: '2026-09-30', amount: 100 }],
    }, user);
    const call = mock.salesContract.create.mock.calls[0][0];
    expect(call.data.lines).toBeDefined();
    expect(call.data.paymentPlans).toBeDefined();
  });

  it('2. detail returns contract with relations', async () => {
    setMock(mock, 'salesContract.findUnique', { id: 1, lines: [], paymentPlans: [] });
    const result: any = await service.detail(1);
    expect(result.id).toBe(1);
  });

  it('3. nextCode generates unique code', async () => {
    setMock(mock, 'salesContract.findFirst', null);
    setMock(mock, 'salesContract.create', { code: 'HT202609210001' });
    await service.create({ title: 'X', customerName: 'Y' }, user);
    const call = mock.salesContract.create.mock.calls[0][0];
    expect(call.data.code).toMatch(/^HT\d{8}\d{4}$/);
  });

  it('4. update transaction rewrites lines and paymentPlans', async () => {
    setMock(mock, '$transaction', async (cb: any) => cb({
      salesContractLine: { deleteMany: async () => ({ count: 0 }) },
      salesContractPaymentPlan: { deleteMany: async () => ({ count: 0 }) },
      salesContract: { update: async () => ({ id: 1 }) },
    }));
    await service.update(1, { title: '改', lines: [], paymentPlans: [] });
    expect(mock.$transaction).toHaveBeenCalled();
  });
});
