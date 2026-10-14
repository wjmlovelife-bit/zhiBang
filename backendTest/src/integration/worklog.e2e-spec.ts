/**
 * Worklog + Weekly Schedule + Sales Schedule 真 PG 测试（拆分 3 个独立文件）
 *
 * 2026-09-21 修复记录：
 *  ① import 类名 WorklogService → WorkLogService（源码大写 L，前几轮单测 spec 同款笔误）。
 *     原 import 为 undefined，Nest 测试容器注册 undefined provider 时误报循环依赖。
 *  ② test 3/4 原调 upsertWeekSummary / upsertDailyReport，源码实际方法为 saveWeeklySummary(user, body) /
 *     saveDailyReport(user, body)，且是幂等行为而非严格 upsert。改为正确方法名 + 正确参数顺序。
 *  ③ test 2 "update excludes ownerId" — 源码 update 不剥离 ownerId（F-L4 已知 bug），按用户选择方案 C-2
 *     只测 content 更新生效，不写 ownerId 断言；源修复后再加回归断言。
 */
import { Test } from '@nestjs/testing';
import { WorkLogService } from '@app/modules/worklog/worklog.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('Worklog (Integration)', () => {
  let worklog: WorkLogService;
  let prisma: PrismaService;
  // 注：不传 deptId——worklog.create 会写 deptId = user.deptId ?? body.deptId，
  // 若 user.deptId 是非空值（如 2）但 sysDept 表里无对应记录，会 FK 失败。
  const user = { id: 2, isAdmin: false };

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [WorkLogService, PrismaService],
    }).compile();
    worklog = module.get<WorkLogService>(WorkLogService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    await prisma.crmWorkLog.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmWeekSummary.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmDailyReport.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUser.upsert({
      where: { id: 2 }, update: {},
      create: { id: 2, username: 'sales01_worklog', name: '张三', password: '123456', isActive: true },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('1. create worklog', async () => {
    const r = await worklog.create({ content: '今日工作', date: '2026-09-21', duration: 1 }, user);
    expect(r.id).toBeGreaterThan(0);
    expect(r.ownerId).toBe(2);
  });

  it('2. update worklog: content 更新生效', async () => {
    const r = await worklog.create({ content: 'A', date: '2026-09-21' }, user);
    await worklog.update(r.id, { content: 'B' }, user);
    const check: any = await prisma.crmWorkLog.findUnique({ where: { id: r.id } });
    expect(check.content).toBe('B');
    expect(check.ownerId).toBe(2);
    // 注：源码 worklog.service.ts:update 当前不剥离 ownerId（F-L4 已知源 bug，PUT 别人的 worklog
    // 能改 ownerId）。本测试不触发越权数据（避免 FK 失败），源修复后再加：
    //   expect(check.ownerId).toBe(2) 在 body 含 {ownerId:999} 时也应成立（回归保护）。
  });

  it('3. saveWeeklySummary 幂等', async () => {
    // 源码：saveWeeklySummary(user, body) — 同一 ownerId+weekStart 二次调用是 update 而非 insert
    await worklog.saveWeeklySummary(user, { weekStart: '2026-09-14', plan: 'P1', content: 'C1' });
    await worklog.saveWeeklySummary(user, { weekStart: '2026-09-14', plan: 'P2', content: 'C2' });
    const all = await prisma.crmWeekSummary.findMany({ where: { ownerId: 2, weekStart: new Date('2026-09-14') } });
    expect(all.length).toBe(1);
    expect(all[0].plan).toBe('P2');
    expect(all[0].content).toBe('C2');
  });

  it('4. saveDailyReport 幂等', async () => {
    await worklog.saveDailyReport(user, { date: '2026-09-21', content: 'D1' });
    await worklog.saveDailyReport(user, { date: '2026-09-21', content: 'D2' });
    const all = await prisma.crmDailyReport.findMany({ where: { ownerId: 2, date: new Date('2026-09-21') } });
    expect(all.length).toBe(1);
    expect(all[0].content).toBe('D2');
  });
});