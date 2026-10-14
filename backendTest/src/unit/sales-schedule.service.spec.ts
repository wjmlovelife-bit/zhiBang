/**
 * SalesScheduleService 单元测试
 * 1. aggregateWeek: customer follow → am/pm 归位
 * 2. aggregateWeek: project follow → customer = project.customer
 * 3. aggregateWeek: period=null 默认归上午
 * 4. getByWeek returns planText + days
 * 5. exportToBuffer returns xlsx Buffer
 */
import { Test } from '@nestjs/testing';
import { SalesScheduleService } from '@app/modules/sales-schedule/sales-schedule.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('SalesScheduleService', () => {
  let service: SalesScheduleService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        SalesScheduleService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<SalesScheduleService>(SalesScheduleService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. customer follow with period=am goes to morning cell', async () => {
    setMock(mock, 'crmCustomerFollow.findMany', [
      {
        id: 1, followerId: 2, customerId: 100, followDate: new Date('2026-09-20'),
        period: 'am', schedule: '日程', contactName: '张三', content: '内容',
        customer: { id: 100, code: 'KH001', name: '客户A' },
      },
    ]);
    setMock(mock, 'crmProjectFollow.findMany', []);
    setMock(mock, 'crmSalesSchedule.findUnique', null);
    const result: any = await service.getByWeek(2, new Date('2026-09-14'));
    const day = result.days[6]; // 20日 周日 index=6（weekStart=2026-09-14 周一 → days[6]=09-20 周日）
    expect(day.am.length).toBe(1);
    expect(day.am[0].customer).toBe('客户A');
    expect(day.am[0].project).toBe(''); // customer follow 无项目
    expect(day.am[0].milestone).toBe(''); // customer follow 无里程碑
    expect(day.am[0].customerId).toBe(100);
  });

  it('2. project follow has customer = project.customer, project = project.name, milestone = project.stage', async () => {
    setMock(mock, 'crmCustomerFollow.findMany', []);
    setMock(mock, 'crmProjectFollow.findMany', [
      {
        id: 1, followerId: 2, projectId: 200, followDate: new Date('2026-09-20'),
        period: 'pm', schedule: '', contactName: null, content: '项目跟进',
        project: {
          id: 200, code: 'PR001', name: '项目A', stage: '报价',
          customer: { id: 100, code: 'KH001', name: '客户A' },
        },
      },
    ]);
    setMock(mock, 'crmSalesSchedule.findUnique', null);
    const result: any = await service.getByWeek(2, new Date('2026-09-14'));
    const day = result.days[6];
    expect(day.pm.length).toBe(1);
    expect(day.pm[0].customer).toBe('客户A'); // 项目关联的客户
    expect(day.pm[0].project).toBe('项目A');
    expect(day.pm[0].milestone).toBe('报价');
    expect(day.pm[0].projectId).toBe(200);
    expect(day.pm[0].customerId).toBe(100);
  });

  it('3. period=null goes to am cell', async () => {
    setMock(mock, 'crmCustomerFollow.findMany', [
      {
        id: 1, followerId: 2, customerId: 100, followDate: new Date('2026-09-20'),
        period: null, schedule: '', contactName: null, content: 'x',
        customer: { id: 100, code: 'KH001', name: '客户A' },
      },
    ]);
    setMock(mock, 'crmProjectFollow.findMany', []);
    setMock(mock, 'crmSalesSchedule.findUnique', null);
    const result: any = await service.getByWeek(2, new Date('2026-09-14'));
    const day = result.days[6];
    expect(day.am.length).toBe(1);
    expect(day.pm.length).toBe(0);
  });

  it('4. getByWeek returns planText from saved record', async () => {
    setMock(mock, 'crmCustomerFollow.findMany', []);
    setMock(mock, 'crmProjectFollow.findMany', []);
    setMock(mock, 'crmSalesSchedule.findUnique', {
      ownerId: 2, weekStart: new Date('2026-09-14'),
      planText: '本周计划', summaryText: '', leaderComment: '',
    });
    const result: any = await service.getByWeek(2, new Date('2026-09-14'));
    expect(result.planText).toBe('本周计划');
    expect(result.days.length).toBe(7);
  });

  it('5. exportToBuffer returns Buffer', async () => {
    setMock(mock, 'crmCustomerFollow.findMany', []);
    setMock(mock, 'crmProjectFollow.findMany', []);
    setMock(mock, 'crmSalesSchedule.findUnique', null);
    const buf = await service.exportToBuffer(2, new Date('2026-09-14'));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
