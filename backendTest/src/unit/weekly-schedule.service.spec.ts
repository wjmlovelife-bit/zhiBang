/**
 * WeeklyScheduleService 单元测试
 * 1. getByWeek returns saved plan/summary + days JSON
 * 2. upsert creates or updates
 * 3. exportToBuffer returns xlsx Buffer
 */
import { Test } from '@nestjs/testing';
import { WeeklyScheduleService } from '@app/modules/weekly-schedule/weekly-schedule.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('WeeklyScheduleService', () => {
  let service: WeeklyScheduleService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        WeeklyScheduleService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<WeeklyScheduleService>(WeeklyScheduleService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. getByWeek returns saved data', async () => {
    // getByWeek 直接返回 DB 行；days 是库中 JSON 字段，mock 需提供
    setMock(mock, 'crmWeeklySchedule.findUnique', {
      ownerId: 2, weekStart: new Date('2026-09-14'),
      planText: '本周计划', summaryText: '', leaderComment: '',
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-09-${14 + i}`,
        am: { content: '', progress: '', done: '', remark: '' },
        pm: { content: '', progress: '', done: '', remark: '' },
      })),
    });
    const result: any = await service.getByWeek(2, new Date('2026-09-14'));
    expect(result.planText).toBe('本周计划');
    expect(result.days.length).toBe(7);
  });

  it('2. upsert creates new record', async () => {
    setMock(mock, 'crmWeeklySchedule.upsert', { id: 1 });
    await service.upsert({
      ownerId: 2, weekStart: '2026-09-14', planText: 'P', summaryText: 'S', leaderComment: 'L',
    });
    expect(mock.crmWeeklySchedule.upsert).toHaveBeenCalled();
  });

  it('3. exportToBuffer returns Buffer', async () => {
    setMock(mock, 'crmWeeklySchedule.findUnique', null);
    setMock(mock, 'crmWeeklySchedule.upsert', { id: 1 });
    setMock(mock, 'crmCustomerFollow.findMany', []);
    setMock(mock, 'crmProjectFollow.findMany', []);
    const buf = await service.exportToBuffer(2, new Date('2026-09-14'));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
