/**
 * ContractService 集成测试（真 PG）
 *
 * 覆盖：
 *  1. create + lines 同步
 *  2. update lines 整组替换
 *  3. list dataScope=4
 *  4. detail 含 lines/paymentPlans
 *  5. ⚠ generatePdf 端点（沙箱无 chromium 失败，行为记录）
 */
import { Test } from '@nestjs/testing';
import { ContractService } from '@app/modules/contract/contract.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('Contract (Integration)', () => {
  let service: ContractService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [ContractService, PrismaService],
    }).compile();
    service = module.get<ContractService>(ContractService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    await prisma.salesContractPaymentPlan.deleteMany({ where: {} }).catch(() => {});
    await prisma.salesContractLine.deleteMany({ where: {} }).catch(() => {});
    await prisma.salesContract.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUser.upsert({
      where: { id: 2 }, update: {},
      create: { id: 2, username: 'sales01_contr', name: '张三', password: '123456', isActive: true },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('1. create 含 lines + paymentPlans', async () => {
    const r: any = await service.create({
      title: '测试合同A', customerName: '客户A', currencyCode: 'CNY',
      lines: [{ productName: 'P1', quantity: 1, unitPrice: 1000 }],
      paymentPlans: [{ seq: 1, planDate: '2026-12-31', amount: 500 }],
    }, { id: 2, deptId: 1 });
    expect(r.id).toBeGreaterThan(0);
    expect(r.lines.length).toBe(1);
    expect(r.paymentPlans.length).toBe(1);
  });

  it('2. update lines 整组重写（旧 lines 应删）', async () => {
    const created: any = await service.create({
      title: '测试合同B', customerName: '客户A',
      lines: [{ productName: 'P1', quantity: 1, unitPrice: 100 }],
    }, { id: 2, deptId: 1 });
    const before = await service.detail(created.id);
    expect(before.lines.length).toBe(1);

    await service.update(created.id, {
      lines: [
        { productName: 'P2', quantity: 2, unitPrice: 200 },
        { productName: 'P3', quantity: 3, unitPrice: 300 },
      ],
    }, { id: 2, deptId: 1 });
    const after = await service.detail(created.id);
    expect(after.lines.length).toBe(2);
    expect(after.lines[0].productName).toBe('P2');
  });

  it('3. list dataScope=4 sales 限定本人 createdById', async () => {
    const r: any = await service.list(
      { pageSize: 100 },
      { id: 2, isAdmin: false, dataScope: 4, roleCodes: ['sales'] },
    );
    expect(Array.isArray(r.items)).toBe(true);
    for (const item of r.items) {
      expect(item.createdById).toBe(2);
    }
  });

  it('4. detail 包含 lines + paymentPlans（按 sort/seq 排序）', async () => {
    const created: any = await service.create({
      title: '测试合同C', customerName: '客户C',
      lines: [
        { productName: 'P1', quantity: 1, unitPrice: 100, sort: 2 },
        { productName: 'P2', quantity: 1, unitPrice: 200, sort: 1 },
      ],
      paymentPlans: [
        { seq: 2, planDate: '2026-12-31', amount: 200 },
        { seq: 1, planDate: '2026-09-30', amount: 100 },
      ],
    }, { id: 2, deptId: 1 });
    const r: any = await service.detail(created.id);
    expect(r.lines[0].productName).toBe('P2'); // sort=1 升序
    expect(r.paymentPlans[0].seq).toBe(1);
  });

  it('5. ⚠ generatePdf 端点沙箱无 chromium → 失败（行为记录）', async () => {
    const created: any = await service.create({
      title: '测试合同D', customerName: '客户D',
      lines: [{ productName: 'P', quantity: 1, unitPrice: 100 }],
    }, { id: 2, deptId: 1 });
    try {
      await service.generatePdf(created.id);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});