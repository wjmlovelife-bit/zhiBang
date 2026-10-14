/**
 * WorklogService 单元测试（核心）
 * 覆盖当前源码真实 API：create / update / getWeeklySummary / saveWeeklySummary / saveDailyReport
 *
 * 说明：原 spec 引用了旧 API（listWeekSummary / upsertWeekSummary / upsertDailyReport），
 * 当前源码已重命名为 getWeeklySummary / saveWeeklySummary / saveDailyReport，故按真实 API 重写。
 *
 * 注意：WorklogService 经 Test.createTestingModule 注册会触发 Nest DI 扫描器的
 * "circular dependency has been detected inside RootTestModule" 假阳性，因此本 spec
 * 直接 new WorklogService(mock) 实例化（该 service 仅依赖 PrismaService，可直接注入 mock）。
 */
import { WorkLogService } from '@app/modules/worklog/worklog.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('WorkLogService', () => {
  let service: WorkLogService;
  let mock: MockPrisma;
  const user = { id: 2, isAdmin: false, deptId: 2 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    // 直接实例化，避免 Nest 测试容器扫描引发的循环依赖误报
    service = new WorkLogService(mock as any);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. create writes worklog with ownerId/createdById from user', async () => {
    setMock(mock, 'crmWorkLog.create', { id: 99, ownerId: 2 });
    await service.create({ content: '测试', date: '2026-09-21', duration: 1 }, user);
    const call = mock.crmWorkLog.create.mock.calls[0][0];
    expect(call.data.ownerId).toBe(2);
    expect(call.data.createdById).toBe(2);
    expect(call.data.content).toBe('测试');
    // 关联对象键与创建人键不应进入 create 数据
    expect(call.data.owner).toBeUndefined();
    expect(call.data.createdBy).toBeUndefined();
  });

  it('2. update sets updatedAt and strips relation/audit keys (ownerId 当前未剥离)', async () => {
    // B-2 已 defer：源码 update 不剥离 ownerId（cleanEmpty 仅处理 '' / null），
    // 因此当前行为下传入 ownerId:999 会原样保留——属已知安全缺口，源修复后应改为断言 undefined。
    setMock(mock, 'crmWorkLog.update', { id: 1 });
    await service.update(1, { content: '改', ownerId: 999 }, user);
    const call = mock.crmWorkLog.update.mock.calls[0][0];
    expect(call.data.content).toBe('改');
    expect(call.data.updatedAt).toBeDefined();
    // owner/createdBy/updatedBy 会被 delete 掉
    expect(call.data.owner).toBeUndefined();
    expect(call.data.createdBy).toBeUndefined();
    expect(call.data.updatedBy).toBeUndefined();
    // 当前源码行为：ownerId 不被剥离（B-2 待源修复）
    expect(call.data.ownerId).toBe(999);
  });

  it('3. getWeeklySummary returns the stored row when found', async () => {
    setMock(mock, 'crmWeekSummary.findUnique', {
      id: 1, ownerId: 2, weekStart: new Date('2026-09-14'), content: '本周', plan: '', attachments: [],
    });
    const result: any = await service.getWeeklySummary(user);
    expect(result.id).toBe(1);
    const call = mock.crmWeekSummary.findUnique.mock.calls[0][0];
    expect(call.where.ownerId_weekStart.ownerId).toBe(2);
  });

  it('4. saveWeeklySummary creates new row when none exists', async () => {
    setMock(mock, 'crmWeekSummary.findUnique', null);
    setMock(mock, 'crmWeekSummary.create', { id: 1 });
    await service.saveWeeklySummary(user, { weekStart: '2026-09-14', content: '本周', plan: '计划' });
    expect(mock.crmWeekSummary.create).toHaveBeenCalled();
    const call = mock.crmWeekSummary.create.mock.calls[0][0];
    expect(call.data.ownerId).toBe(2);
    expect(call.data.weekStart).toBeDefined();
    expect(call.data.content).toBe('本周');
  });

  it('5. saveDailyReport creates new row when none exists', async () => {
    setMock(mock, 'crmDailyReport.findUnique', null);
    setMock(mock, 'crmDailyReport.create', { id: 1 });
    await service.saveDailyReport(user, { date: '2026-09-21', content: '日报' });
    expect(mock.crmDailyReport.create).toHaveBeenCalled();
    const call = mock.crmDailyReport.create.mock.calls[0][0];
    expect(call.data.ownerId).toBe(2);
    expect(call.data.content).toBe('日报');
  });
});
