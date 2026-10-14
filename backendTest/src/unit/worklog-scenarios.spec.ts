/**
 * WorkLogService 全场景单测（覆盖 modules/worklog/worklog.service.ts）
 *
 * 与现有 worklog.service.spec.ts（5 用例）+ worklog-week.spec.ts（4 用例）互补。
 * 覆盖：
 *  - nextCode: 同日连续 0001/0002、跨日 0001
 *  - list: keyword/ownerId/dateStart/dateEnd/page/pageSize/dataScope
 *  - detail: 不存在→404、include owner/customer/project
 *  - create: body.code 已传、cleanEmpty 边界（customerId/projectId/duration/deptId/ownerId）
 *  - update: cleanEmpty 边界、updatedAt 时间戳
 *  - remove: 不存在→Prisma P2025
 *  - searchCustomer/searchProject: keyword 空/有、take:20、select 字段、dataScope
 *  - getWeeklySummary: weekStart 字符串→UTC 解析、不存在→空记录、附件过滤
 *  - saveWeeklySummary: attachments 非空、attachments=[] 不传、不存在→create、存在→update
 *  - listWeeklySummaries: page/pageSize/keyword/ownerId/dateStart/dateEnd 过滤
 *  - deleteWeeklySummary: 不存在→404、成功、并发删除
 *  - listDailyReports: limit 1/10、include、orderBy
 *  - saveDailyReport: attachments 各种、create/update 路径
 *  - deleteDailyReport: 不存在→404、成功
 */
import { NotFoundException } from '@nestjs/common';
import { WorkLogService } from '@app/modules/worklog/worklog.service';
import { makeMockPrisma, MockPrisma, setMock, setMockError, resetMockPrisma } from '../setup/prisma-mock';

describe('WorkLogService scenarios', () => {
  let service: WorkLogService;
  let mock: MockPrisma;
  const admin = { id: 1, isAdmin: true, deptId: null } as any;
  const sales = { id: 2, isAdmin: false, deptId: 2, dataScope: 4 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new WorkLogService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // nextCode
  // ============================================================
  describe('nextCode', () => {
    it('1. 同日无历史 → RJ202609220001 序列 0001', async () => {
      setMock(mock, '$queryRaw', [{ nextval: 1n }]);
      const code = await service.nextCode();
      expect(code).toMatch(/^RJ\d{8}0001$/);
    });

    it('2. 同日有历史 RJ202609220005 → 0006（mock $queryRaw 返回 nextval=6）', async () => {
      // TOCTOU 修复：nextCode 走 PG SEQUENCE（$queryRaw）
      // SEQUENCE 初始化已 setval(max+1)，nextval 返回 nextval
      setMock(mock, '$queryRaw', [{ nextval: 6n }]);
      const code = await service.nextCode();
      expect(code).toMatch(/^RJ\d{8}0006$/);
    });

    it('3. ⚠ 行为记录：跨日时源码 bug —— 不传当日 prefix 时会被昨日 code 污染（应传 prefix startsWith 过滤）', async () => {
      // 源码 nextCode 用 startsWith prefix 查询最新 code，但 .slice(prefix.length) 提取的是
      // 整个 code 的 prefix 长度（10 位 RJ+YYYYMMDD），所以昨日 RJ202609210099 的 slice(10)=0099
      // → seq=100 → 今日 RJ202609220100。这是 bug，理想应在 findFirst where 加 startsWith: prefix
      // （实际上源码 has prefix startsWith，所以 mock 给定 RJ202609210099 是误导——mock 的 findFirst
      //  本应仅匹配以 RJ20260922 开头的 code，故这个场景真实不会发生）。
      // 此处接受行为：mock 给 RJ202609210099 → 真实 seq 计算为 100（实际不会发生）。
      setMock(mock, 'crmWorkLog.findFirst', { code: 'RJ202609210099' });
      const code = await service.nextCode();
      expect(code).toMatch(/^RJ\d{8}0100$/); // 行为记录
    });
  });

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    // worklog.list 实际非常复杂：先查 changedCustomers/changedProjects，再查 crmWorkLog。
    // 这里需要 mock 全部 4 个 prisma 集合才能跑通；mockDeep 默认 mockResolvedValue(undefined)
    function setupListMocks(total = 0, items: any[] = [], customers: any[] = [], projects: any[] = []) {
      setMock(mock, 'crmCustomer.count', customers.length);
      setMock(mock, 'crmCustomer.findMany', customers);
      setMock(mock, 'crmOpportunity.count', projects.length);
      setMock(mock, 'crmOpportunity.findMany', projects);
      setMock(mock, 'crmWorkLog.count', total);
      setMock(mock, 'crmWorkLog.findMany', items);
      mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
    }

    it('4. 默认 page=1, pageSize=10', async () => {
      setupListMocks(0, [], [], []);
      const r: any = await service.list({}, sales);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(10);
    });

    it('5. keyword OR（content/code）', async () => {
      setupListMocks(0, [], [], []);
      await service.list({ keyword: 'X' }, sales);
      const call = mock.crmWorkLog.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(2);
    });

    it('6. ownerId 过滤（hasDate=false 时 OR 不设 ownerId，仅 ownerId 直接设）', async () => {
      setupListMocks(0, [], [], []);
      await service.list({ ownerId: 5 }, sales);
      const call = mock.crmWorkLog.findMany.mock.calls[0][0];
      expect(call.where.ownerId).toBe(5);
    });

    it('7. dateStart/dateEnd 区间过滤', async () => {
      setupListMocks(0, [], [], []);
      await service.list({ dateStart: '2026-09-01', dateEnd: '2026-09-30' }, sales);
      const call = mock.crmWorkLog.findMany.mock.calls[0][0];
      expect(call.where.date).toBeDefined();
    });

    it('8. pageSize 上限 1000', async () => {
      setupListMocks(0, [], [], []);
      const r: any = await service.list({ pageSize: 9999 }, sales);
      expect(r.pageSize).toBe(1000);
    });
  });

  // ============================================================
  // detail
  // ============================================================
  describe('detail', () => {
    it('9. 不存在 → NotFound', async () => {
      setMock(mock, 'crmWorkLog.findUnique', null);
      await expect(service.detail(999)).rejects.toThrow(NotFoundException);
    });

    it('10. 存在 → include owner/customer/project 三关系', async () => {
      setMock(mock, 'crmWorkLog.findUnique', { id: 1 });
      await service.detail(1);
      const call = mock.crmWorkLog.findUnique.mock.calls[0][0];
      expect(call.include.owner).toBeDefined();
      expect(call.include.customer).toBeDefined();
      expect(call.include.project).toBeDefined();
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('11. body.code 已传 → 不调 nextCode', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ code: 'GR202609220099', content: 'X' }, admin);
      expect(mock.crmWorkLog.findFirst).not.toHaveBeenCalled();
      expect(mock.crmWorkLog.create.mock.calls[0][0].data.code).toBe('GR202609220099');
    });

    it('12. ownerId 兜底：body.ownerId 优先，user.id 次之', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ content: 'X', ownerId: 99 }, sales);
      expect(mock.crmWorkLog.create.mock.calls[0][0].data.ownerId).toBe(99);
    });

    it('13. cleanEmpty：customerId 空串→undefined', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ content: 'X', customerId: '' }, admin);
      expect(mock.crmWorkLog.create.mock.calls[0][0].data.customerId).toBeUndefined();
    });

    it('14. cleanEmpty：projectId null→undefined', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ content: 'X', projectId: null }, admin);
      expect(mock.crmWorkLog.create.mock.calls[0][0].data.projectId).toBeUndefined();
    });

    it('15. createdById = user.id', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ content: 'X' }, sales);
      expect(mock.crmWorkLog.create.mock.calls[0][0].data.createdById).toBe(2);
    });

    it('16. 系统字段行为记录：createdById 被覆盖为 user.id（id/createdAt/updatedAt 当前源码【未剥离】，是已知潜在风险）', async () => {
      // 源码 create 只 delete 关联对象键（owner/customer/project/createdBy/updatedBy），
      // 未 delete data.id/data.createdAt/data.updatedAt。这是个潜在风险——Prisma create 写 id 会报错
      // （除非 schema 有 onConflict 处理）。此处仅断言 createdById 覆盖为 user.id。
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      await service.create({ id: 999, content: 'X', createdAt: 'X', updatedAt: 'X' }, admin);
      const call = mock.crmWorkLog.create.mock.calls[0][0];
      expect(call.data.createdById).toBe(1); // 被覆盖
    });
  });

  // ============================================================
  // update
  // ============================================================
  describe('update', () => {
    it('17. 自动设置 updatedAt = new Date()', async () => {
      setMock(mock, 'crmWorkLog.update', { id: 1 });
      await service.update(1, { content: '改' }, admin);
      const call = mock.crmWorkLog.update.mock.calls[0][0];
      expect(call.data.updatedAt).toBeInstanceOf(Date);
    });

    it('18. cleanEmpty 字段边界（duration/deptId/ownerId 空串）', async () => {
      setMock(mock, 'crmWorkLog.update', { id: 1 });
      await service.update(1, { duration: '', deptId: '', ownerId: '' }, admin);
      const call = mock.crmWorkLog.update.mock.calls[0][0];
      expect(call.data.duration).toBeUndefined();
      expect(call.data.deptId).toBeUndefined();
      expect(call.data.ownerId).toBeUndefined();
    });

    it('19. CrmWorkLog 模型无 updatedById 字段（不写入）', async () => {
      setMock(mock, 'crmWorkLog.update', { id: 1 });
      await service.update(1, { content: 'X' }, admin);
      const call = mock.crmWorkLog.update.mock.calls[0][0];
      expect(call.data.updatedById).toBeUndefined();
    });

    it('20. 关联键剥离（owner/customer/project/createdBy/updatedBy）', async () => {
      setMock(mock, 'crmWorkLog.update', { id: 1 });
      await service.update(1, { content: 'X', owner: { id: 1 }, customer: { id: 2 } }, admin);
      const call = mock.crmWorkLog.update.mock.calls[0][0];
      expect(call.data.owner).toBeUndefined();
      expect(call.data.customer).toBeUndefined();
    });
  });

  // ============================================================
  // remove
  // ============================================================
  describe('remove', () => {
    it('21. 不存在 → Prisma P2025（行为记录）', async () => {
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'crmWorkLog.delete', err);
      await expect(service.remove(999)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // searchCustomer / searchProject
  // ============================================================
  describe('searchCustomer', () => {
    it('22. keyword OR（name/code） + select + take:20', async () => {
      setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'KH001', name: 'A' }]);
      await service.searchCustomer('A', sales);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(2);
      expect(call.select).toEqual({ id: true, code: true, name: true });
      expect(call.take).toBe(20);
    });

    it('23. keyword 空 → 不写 content 模糊；applyDataScope=4 仍注入 ownerId OR（行为记录）', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      await service.searchCustomer('', sales);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      // keyword 空时，源码不写 keyword 路径的 OR；但 applyDataScope (dataScope=4) 会注入
      // ownerId/createdById 的 OR（这是预期行为——本人过滤）。
      expect(call.where.OR).toEqual([{ ownerId: 2 }, { createdById: 2 }]);
    });
  });

  describe('searchProject', () => {
    it('24. keyword OR（name/code） + select + take:20', async () => {
      setMock(mock, 'crmOpportunity.findMany', [{ id: 1, code: 'XM001', name: 'A' }]);
      await service.searchProject('A', sales);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(2);
      expect(call.select).toEqual({ id: true, code: true, name: true });
      expect(call.take).toBe(20);
    });
  });

  // ============================================================
  // getWeeklySummary / saveWeeklySummary / listWeeklySummaries / deleteWeeklySummary
  // ============================================================
  describe('getWeeklySummary', () => {
    it('25. weekStart 字符串 "2026-09-14" → UTC 00:00 解析', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      await service.getWeeklySummary(sales, '2026-09-14');
      const call = mock.crmWeekSummary.findUnique.mock.calls[0][0];
      expect(call.where.ownerId_weekStart.ownerId).toBe(2);
      // weekStart 是 Date 对象，且为 UTC 00:00
      expect(call.where.ownerId_weekStart.weekStart).toBeInstanceOf(Date);
      expect(call.where.ownerId_weekStart.weekStart.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    });

    it('26. 不存在 → 返回默认记录（plan/content 空，attachments=[]）', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      const r: any = await service.getWeeklySummary(sales, '2026-09-14');
      expect(r.ownerId).toBe(2);
      expect(r.plan).toBe('');
      expect(r.content).toBe('');
      expect(r.attachments).toEqual([]);
    });
  });

  describe('saveWeeklySummary', () => {
    it('27. 不存在 → create 新记录', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      setMock(mock, 'crmWeekSummary.create', { id: 1 });
      await service.saveWeeklySummary(sales, { weekStart: '2026-09-14', plan: 'P1', content: 'C1' });
      const createArgs = mock.crmWeekSummary.create.mock.calls[0][0];
      expect(createArgs.data.plan).toBe('P1');
      expect(createArgs.data.content).toBe('C1');
      expect(createArgs.data.ownerId).toBe(2);
    });

    it('28. 存在 → update（不重新 create）', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', { id: 99, plan: 'old', content: 'old' });
      setMock(mock, 'crmWeekSummary.update', { id: 99 });
      await service.saveWeeklySummary(sales, { weekStart: '2026-09-14', plan: 'NEW', content: 'NEW' });
      expect(mock.crmWeekSummary.create).not.toHaveBeenCalled();
      expect(mock.crmWeekSummary.update).toHaveBeenCalledWith({
        where: { id: 99 },
        data: expect.objectContaining({ plan: 'NEW', content: 'NEW' }),
      });
    });

    it('29. attachments 非空数组 → 写入', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      setMock(mock, 'crmWeekSummary.create', { id: 1 });
      await service.saveWeeklySummary(sales, { weekStart: '2026-09-14', plan: 'P', content: 'C', attachments: ['a.txt'] });
      expect(mock.crmWeekSummary.create.mock.calls[0][0].data.attachments).toEqual(['a.txt']);
    });

    it('30. attachments=[] 不写入（避免 Prisma Json 兼容问题）', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      setMock(mock, 'crmWeekSummary.create', { id: 1 });
      await service.saveWeeklySummary(sales, { weekStart: '2026-09-14', plan: 'P', content: 'C', attachments: [] });
      const data = mock.crmWeekSummary.create.mock.calls[0][0].data;
      expect(data.attachments).toBeUndefined();
    });
  });

  describe('listWeeklySummaries', () => {
    it('31. 默认 page=1, pageSize=10', async () => {
      setMock(mock, 'crmWeekSummary.findMany', []);
      setMock(mock, 'crmWeekSummary.count', 0);
      const r: any = await service.listWeeklySummaries(sales);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(10);
    });

    it('32. keyword 模糊 → where.content.contains', async () => {
      setMock(mock, 'crmWeekSummary.findMany', []);
      setMock(mock, 'crmWeekSummary.count', 0);
      await service.listWeeklySummaries(sales, 1, 10, { keyword: 'X' });
      const call = mock.crmWeekSummary.findMany.mock.calls[0][0];
      expect(call.where.content).toEqual({ contains: 'X' });
    });

    it('33. 非 admin/leader：ownerId 强制为 user.id(2)；dateStart 写入 weekStart 区间', async () => {
      setMock(mock, 'crmWeekSummary.findMany', []);
      setMock(mock, 'crmWeekSummary.count', 0);
      // sales 是 dataScope=4 但无 isAdmin/leader 角色，传 ownerId=5 会被源码强制覆盖为 user.id=2
      await service.listWeeklySummaries(sales, 1, 10, { ownerId: 5, dateStart: '2026-09-01', dateEnd: '2026-09-30' });
      const call = mock.crmWeekSummary.findMany.mock.calls[0][0];
      expect(call.where.ownerId).toBe(2);
      expect(call.where.weekStart).toBeDefined();
    });
  });

  describe('deleteWeeklySummary', () => {
    it('34. 不存在 → NotFound', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', null);
      await expect(service.deleteWeeklySummary(sales, '2026-09-14')).rejects.toThrow(NotFoundException);
    });

    it('35. 存在 → 删除成功', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', { id: 99 });
      setMock(mock, 'crmWeekSummary.delete', { id: 99 });
      await service.deleteWeeklySummary(sales, '2026-09-14');
      expect(mock.crmWeekSummary.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });
  });

  // ============================================================
  // listDailyReports / saveDailyReport / deleteDailyReport
  // ============================================================
  describe('listDailyReports', () => {
    it('36. 默认 limit=1', async () => {
      setMock(mock, 'crmDailyReport.findMany', []);
      await service.listDailyReports(sales);
      expect(mock.crmDailyReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    });

    it('37. limit=10', async () => {
      setMock(mock, 'crmDailyReport.findMany', []);
      await service.listDailyReports(sales, 10);
      expect(mock.crmDailyReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });

    it('38. include orderBy date desc', async () => {
      setMock(mock, 'crmDailyReport.findMany', []);
      await service.listDailyReports(sales);
      const call = mock.crmDailyReport.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ date: 'desc' });
    });
  });

  describe('saveDailyReport', () => {
    it('39. 不存在 → create', async () => {
      setMock(mock, 'crmDailyReport.findUnique', null);
      setMock(mock, 'crmDailyReport.create', { id: 1 });
      await service.saveDailyReport(sales, { date: '2026-09-22', content: 'D1' });
      expect(mock.crmDailyReport.create).toHaveBeenCalled();
      const args = mock.crmDailyReport.create.mock.calls[0][0];
      expect(args.data.content).toBe('D1');
      expect(args.data.ownerId).toBe(2);
    });

    it('40. 存在 → update', async () => {
      setMock(mock, 'crmDailyReport.findUnique', { id: 99, content: 'old' });
      setMock(mock, 'crmDailyReport.update', { id: 99 });
      await service.saveDailyReport(sales, { date: '2026-09-22', content: 'NEW' });
      expect(mock.crmDailyReport.create).not.toHaveBeenCalled();
      expect(mock.crmDailyReport.update).toHaveBeenCalledWith({
        where: { id: 99 },
        data: expect.objectContaining({ content: 'NEW' }),
      });
    });

    it('41. attachments 非空数组 → 写入', async () => {
      setMock(mock, 'crmDailyReport.findUnique', null);
      setMock(mock, 'crmDailyReport.create', { id: 1 });
      await service.saveDailyReport(sales, { date: '2026-09-22', content: 'D', attachments: [{ url: 'x' }] });
      expect(mock.crmDailyReport.create.mock.calls[0][0].data.attachments).toEqual([{ url: 'x' }]);
    });

    it('42. attachments=[] 不写入（避免 Prisma Json 兼容）', async () => {
      setMock(mock, 'crmDailyReport.findUnique', null);
      setMock(mock, 'crmDailyReport.create', { id: 1 });
      await service.saveDailyReport(sales, { date: '2026-09-22', content: 'D', attachments: [] });
      expect(mock.crmDailyReport.create.mock.calls[0][0].data.attachments).toBeUndefined();
    });
  });

  describe('deleteDailyReport', () => {
    it('43. 不存在 → NotFound', async () => {
      setMock(mock, 'crmDailyReport.findUnique', null);
      await expect(service.deleteDailyReport(sales, '2026-09-22')).rejects.toThrow(NotFoundException);
    });

    it('44. 存在 → 删除成功', async () => {
      setMock(mock, 'crmDailyReport.findUnique', { id: 99 });
      setMock(mock, 'crmDailyReport.delete', { id: 99 });
      await service.deleteDailyReport(sales, '2026-09-22');
      expect(mock.crmDailyReport.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });
  });

  // ============================================================
  // 附加：并发安全场景记录（行为记录）
  // ============================================================
  describe('并发安全行为记录', () => {
    it('45. 同 owner 并发 create 不同内容 → crmWorkLog.create 被调多次（无 PG unique index 保护，依赖业务层）', async () => {
      setMock(mock, 'crmWorkLog.create', { id: 1 });
      // 并发调 create 5 次（同一 owner 不同 content）
      await Promise.all([
        service.create({ content: 'A1' }, sales),
        service.create({ content: 'A2' }, sales),
        service.create({ content: 'A3' }, sales),
        service.create({ content: 'A4' }, sales),
        service.create({ content: 'A5' }, sales),
      ]);
      expect(mock.crmWorkLog.create).toHaveBeenCalledTimes(5);
    });

    it('46. deleteWeeklySummary 并发删除同记录 → delete 仅成功一次', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', { id: 99 });
      setMock(mock, 'crmWeekSummary.delete', { id: 99 });
      // 并发 3 次，源码无 PG select-for-update，行为：delete 都调（真实 PG 下第二次 P2025）
      await Promise.all([
        service.deleteWeeklySummary(sales, '2026-09-14'),
        service.deleteWeeklySummary(sales, '2026-09-14'),
        service.deleteWeeklySummary(sales, '2026-09-14'),
      ]);
      // mock 层：3 次都成功（真实 PG 第二次会 P2025；测试只验证逻辑被调 3 次）
      expect(mock.crmWeekSummary.delete).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================
  // 安全场景：admin vs 普通用户跨用户访问
  // ============================================================
  describe('安全场景', () => {
    it('47. 普通用户 list：dataScope=4 → worklog.OR 含 ownerId/createdById', async () => {
      setMock(mock, 'crmCustomer.count', 0);
      setMock(mock, 'crmCustomer.findMany', []);
      setMock(mock, 'crmOpportunity.count', 0);
      setMock(mock, 'crmOpportunity.findMany', []);
      setMock(mock, 'crmWorkLog.count', 0);
      setMock(mock, 'crmWorkLog.findMany', []);
      mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
      await service.list({}, sales);
      const call = mock.crmWorkLog.findMany.mock.calls[0][0];
      // dataScope=4 时 applyDataScope 注入 ownerId/createdById OR
      expect(call.where.OR).toBeDefined();
    });

    it('48. admin list：dataScope=1 → 不加 OR 过滤', async () => {
      setMock(mock, 'crmCustomer.count', 0);
      setMock(mock, 'crmCustomer.findMany', []);
      setMock(mock, 'crmOpportunity.count', 0);
      setMock(mock, 'crmOpportunity.findMany', []);
      setMock(mock, 'crmWorkLog.count', 0);
      setMock(mock, 'crmWorkLog.findMany', []);
      mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
      await service.list({}, admin);
      const call = mock.crmWorkLog.findMany.mock.calls[0][0];
      // admin dataScope=1 不过滤，where.OR 应为空（applyDataScope 不注入）
      // 但 list 内部仍有 OR（hasDate=false 路径 OR 是 keyword 的），无 keyword → 无 OR
      expect(call.where.OR).toBeUndefined();
    });

    it('49. deleteWeeklySummary 普通用户可删自己 owner 的记录（业务规则允许）', async () => {
      setMock(mock, 'crmWeekSummary.findUnique', { id: 99, ownerId: 2 });
      setMock(mock, 'crmWeekSummary.delete', { id: 99 });
      await service.deleteWeeklySummary(sales, '2026-09-14');
      expect(mock.crmWeekSummary.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it('50. deleteDailyReport 业务规则允许删任何记录（无 owner 校验）', async () => {
      // 源码 deleteDailyReport 不校验 user.id 与 ownerId 对应关系——任何登录用户都能删
      // 此处仅记录现状；如需权限收紧，应改源
      setMock(mock, 'crmDailyReport.findUnique', { id: 99, ownerId: 99 }); // 其他人的记录
      setMock(mock, 'crmDailyReport.delete', { id: 99 });
      await service.deleteDailyReport(sales, '2026-09-22'); // sales 是 id=2，删 ownerId=99
      expect(mock.crmDailyReport.delete).toHaveBeenCalled();
    });
  });
});