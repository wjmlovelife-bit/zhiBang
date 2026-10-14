/**
 * Sales Schedule 真 PG 测试
 */
import { Test } from '@nestjs/testing';
import { SalesScheduleService } from '@app/modules/sales-schedule/sales-schedule.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('SalesSchedule (Integration)', () => {
  let sales: SalesScheduleService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [SalesScheduleService, PrismaService],
    }).compile();
    sales = module.get<SalesScheduleService>(SalesScheduleService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    await prisma.crmCustomerFollow.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmProjectFollow.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmContact.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmProjectItem.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmOpportunity.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmCustomer.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmSalesSchedule.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUser.upsert({
      where: { id: 2 }, update: {},
      create: { id: 2, username: 'sales01_salessch', name: '张三', password: '123456', isActive: true },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('1. addFollow (customer) + aggregateWeek → 客户名填入', async () => {
    const c = await prisma.crmCustomer.create({
      data: { code: 'KH202609210099', name: '客户S', ownerId: 2, createdById: 2 },
    });
    await prisma.crmCustomerFollow.create({
      data: {
        customerId: c.id, followerId: 2,
        // 注意：weekStart=2026-09-14 那周在 UTC 区间 [09-14 00:00, 09-20 23:59:59.999]（闭区间，
        // 源码 sales-schedule.service.ts:34-41）。09-21 00:00 落在区间外——改为 09-20 18:00。
        followDate: new Date('2026-09-20T18:00:00Z'),
        period: 'am', schedule: '日程', content: '联系', contactName: '张三',
      },
    });
    const data: any = await sales.getByWeek(2, new Date('2026-09-14'));
    const day = data.days[6];
    expect(day.am.length).toBeGreaterThanOrEqual(1);
    const match = day.am.find((cell: any) => cell.customer === '客户S');
    expect(match).toBeDefined();
    expect(match.customerId).toBe(c.id);
  });

  it('2. period=null → 默认归上午', async () => {
    const c = await prisma.crmCustomer.create({
      data: { code: 'KH202609210088', name: '客户T', ownerId: 2, createdById: 2 },
    });
    await prisma.crmCustomerFollow.create({
      data: {
        customerId: c.id, followerId: 2,
        // 同 test 1：09-20 落在 weekStart=09-14 的闭区间内
        followDate: new Date('2026-09-20T13:00:00Z'),
        period: null, schedule: '', content: 'X', contactName: null,
      },
    });
    const data: any = await sales.getByWeek(2, new Date('2026-09-14'));
    const day = data.days[6];
    const matchedAm = day.am.find((cell: any) => cell.customer === '客户T');
    const matchedPm = day.pm.find((cell: any) => cell.customer === '客户T');
    expect(matchedAm).toBeDefined();
    expect(matchedPm).toBeUndefined();
  });

  it('3. exportToBuffer returns xlsx', async () => {
    const buf = await sales.exportToBuffer(2, new Date('2026-09-14'));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
