/**
 * Weekly Schedule 真 PG 测试
 */
import { Test } from '@nestjs/testing';
import { WeeklyScheduleService } from '@app/modules/weekly-schedule/weekly-schedule.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('WeeklySchedule (Integration)', () => {
  let weekly: WeeklyScheduleService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [WeeklyScheduleService, PrismaService],
    }).compile();
    weekly = module.get<WeeklyScheduleService>(WeeklyScheduleService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    await prisma.crmWeeklySchedule.deleteMany({ where: {} }).catch(() => {});
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('1. upsert + getByWeek', async () => {
    await weekly.upsert({
      ownerId: 2, weekStart: '2026-09-14',
      planText: '计划', summaryText: '总结', leaderComment: '评',
    });
    const data: any = await weekly.getByWeek(2, new Date('2026-09-14'));
    expect(data.planText).toBe('计划');
    expect(data.summaryText).toBe('总结');
    expect(data.leaderComment).toBe('评');
    // upsert 未传 days 时，DB 存 days=null（weekly-schedule.service.ts:35）；前端由 defaultDays 兜底占位 7 天
    expect(data.days == null || Array.isArray(data.days)).toBe(true);
    if (Array.isArray(data.days)) expect(data.days.length === 7 || data.days.length === 0).toBe(true);
  });

  it('2. exportToBuffer returns xlsx', async () => {
    const buf = await weekly.exportToBuffer(2, new Date('2026-09-14'));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
