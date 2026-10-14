/**
 * WorkLogService 周/日总结与搜索扩展测试（覆盖 modules/worklog/worklog.service.ts）
 *
 * 直接实例化（仅依赖 PrismaService），覆盖：
 * - listWeeklySummaries：无当前周记录时首页补空占位
 * - listDailyReports：无今日记录时补空占位
 * - searchCustomer / searchProject：按关键字返回匹配
 * 注：startOfLastSaturday / 跨时区归属属私有/运行期依赖，未在此覆盖（源码私有方法）。
 */
import { WorkLogService } from '@app/modules/worklog/worklog.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('WorkLogService weekly/daily/search', () => {
  let service: WorkLogService;
  let mock: MockPrisma;
  const user = { id: 2, isAdmin: false, name: 'u', deptId: 2 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new WorkLogService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  it('1. listWeeklySummaries 无当前周记录时首页补空占位', async () => {
    setMock(mock, 'crmWeekSummary.count', 0);
    setMock(mock, 'crmWeekSummary.findMany', []);
    const r: any = await service.listWeeklySummaries(user, 1, 10, {});
    expect(r.items.length).toBe(1);
    expect(r.items[0].ownerId).toBe(2);
    expect(r.items[0].content).toBe('');
    expect(r.items[0].weekStart).toBeInstanceOf(Date);
  });

  it('2. listDailyReports 无今日记录时补空占位', async () => {
    setMock(mock, 'crmDailyReport.findMany', []);
    const r: any = await service.listDailyReports(user, 1);
    expect(r.length).toBe(1);
    expect(r[0].ownerId).toBe(2);
    expect(r[0].content).toBe('');
    expect(r[0].date).toBeInstanceOf(Date);
  });

  it('3. searchCustomer 按关键字返回匹配客户', async () => {
    setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'C1', name: '客户A' }]);
    const r: any = await service.searchCustomer('A', user);
    expect(r.length).toBe(1);
    expect(r[0].name).toBe('客户A');
    const call = mock.crmCustomer.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
  });

  it('4. searchProject 按关键字返回匹配项目', async () => {
    setMock(mock, 'crmOpportunity.findMany', [{ id: 1, code: 'P1', name: '项目A' }]);
    const r: any = await service.searchProject('P', user);
    expect(r.length).toBe(1);
    expect(r[0].name).toBe('项目A');
    const call = mock.crmOpportunity.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
  });
});
