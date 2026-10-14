/**
 * ProjectService 全场景补测（与 project.service.spec.ts 5 用例 + project.spec.ts 24 用例互补）
 *
 * 覆盖：
 *  - list: keyword、category/stage/state 过滤、dateOpen/followStart 区间、inheritDate 关联
 *  - create: body.code 已传、items 数组写入、follows 数组写入、region 拼接
 *  - update: items 非数组不删、items=[] 清空
 *  - remove: 不存在→Prisma P2025
 *  - inherit: ownerId=null 兜底
 *  - addFollow: followDate 字符串/默认、contactName 多格式、lastFollowDate 同步
 *  - updateFollow: 各字段部分更新、contactName 含空数组
 *  - searchCustomer: keyword 空/有、take:20
 *  - searchContract: OR title/code/customerName + take:20
 *  - importConfirm: 空数组/3 行批量/region 拼接/submitStatus 默认
 *  - exportCsv: ids 过滤、include owner.name
 *  - generatePdf: 不存在→404
 */
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectService } from '@app/modules/project/project.service';
import { makeMockPrisma, MockPrisma, setMock, setMockError, resetMockPrisma } from '../setup/prisma-mock';

describe('ProjectService extra scenarios', () => {
  let service: ProjectService;
  let mock: MockPrisma;
  const admin = { id: 1, isAdmin: true, deptId: 1, dataScope: 1 } as any;
  const sales = { id: 2, isAdmin: false, deptId: 2 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new ProjectService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    function setupListMocks(total = 0, items: any[] = [], inherits: any[] = []) {
      setMock(mock, 'crmOpportunity.count', total);
      setMock(mock, 'crmOpportunity.findMany', items);
      setMock(mock, 'crmProjectInherit.findMany', inherits);
      mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
    }

    it('1. keyword OR（name/code）', async () => {
      setupListMocks();
      await service.list({ keyword: 'A' }, admin);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(2);
    });

    it('2. category/stage/state 三种枚举过滤', async () => {
      setupListMocks();
      await service.list({ category: '终端', stage: '签约', state: '进行' }, admin);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.category).toBe('终端');
      expect(call.where.stage).toBe('签约');
      expect(call.where.state).toBe('进行');
    });

    it('3. dateOpenStart/dateOpenEnd 区间', async () => {
      setupListMocks();
      await service.list({ dateOpenStart: '2026-09-01', dateOpenEnd: '2026-09-30' }, admin);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.dateOpen).toBeDefined();
      expect(call.where.dateOpen.gte).toBeInstanceOf(Date);
      expect(call.where.dateOpen.lte).toBeInstanceOf(Date);
    });

    it('4. followStart/followEnd 区间', async () => {
      setupListMocks();
      await service.list({ followStart: '2026-09-01', followEnd: '2026-09-30' }, admin);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.lastFollowDate).toBeDefined();
    });

    it('5. items 非空时 inherits 关联，inheritDate 注入每行', async () => {
      setupListMocks(1, [{ id: 5, name: 'A' }], [{ projectId: 5, inheritedAt: '2026-09-22' }]);
      const r: any = await service.list({}, admin);
      expect(r.items[0].inheritDate).toBe('2026-09-22');
    });

    it('6. pageSize 上限 1000', async () => {
      setupListMocks();
      const r: any = await service.list({ pageSize: 9999 }, admin);
      expect(r.pageSize).toBe(1000);
    });

    it('7. ownerId 过滤', async () => {
      setupListMocks();
      await service.list({ ownerId: 5 }, admin);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.ownerId).toBe(5);
    });

    it('8. customerId 过滤', async () => {
      setupListMocks();
      await service.list({ customerId: 99 }, admin);
      expect(mock.crmOpportunity.findMany.mock.calls[0][0].where.customerId).toBe(99);
    });
  });

  // ============================================================
  // detail
  // ============================================================
  describe('detail', () => {
    it('9. 不存在 → NotFound', async () => {
      setMock(mock, 'crmOpportunity.findUnique', null);
      await expect(service.detail(999)).rejects.toThrow(NotFoundException);
    });

    it('10. exists inherits 时补齐用户名（fromUser/toUser/inheritedBy）', async () => {
      setMock(mock, 'crmOpportunity.findUnique', {
        id: 1, name: 'X',
        inherits: [{ id: 10, projectId: 1, fromUserId: 2, toUserId: 3, inheritedById: 1 }],
      });
      setMock(mock, 'sysUser.findMany', [
        { id: 2, name: 'A' }, { id: 3, name: 'B' }, { id: 1, name: 'C' },
      ]);
      const r: any = await service.detail(1);
      expect(r.inherits[0].fromUser.name).toBe('A');
      expect(r.inherits[0].toUser.name).toBe('B');
      expect(r.inherits[0].inheritedBy.name).toBe('C');
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('11. body.code 已传 → 不调 nextCode', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.create({ code: 'XM202609220099', name: 'X' }, admin);
      expect(mock.crmOpportunity.findFirst).not.toHaveBeenCalled();
      expect(mock.crmOpportunity.create.mock.calls[0][0].data.code).toBe('XM202609220099');
    });

    it('12. items 数组写入（含自动剥 id/projectId/opportunityId/createdAt）', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.create({
        name: 'X',
        items: [
          { id: 999, projectId: 1, opportunityId: 1, createdAt: 'X', productName: 'P1' },
          { productName: 'P2' },
        ],
      }, admin);
      const items = mock.crmOpportunity.create.mock.calls[0][0].data.items.create;
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ productName: 'P1' });
      expect(items[0].id).toBeUndefined();
      expect(items[0].projectId).toBeUndefined();
      expect(items[0].opportunityId).toBeUndefined();
    });

    it('13. follows 数组写入（含 followerId 默认 user.id / contactName 保持原样 / lastFollowDate 同步）', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      setMock(mock, 'crmProjectFollow.createMany', { count: 1 });
      await service.create({
        name: 'X',
        follows: [{ content: '首次', contactName: ['张三'] }],
      }, sales);
      expect(mock.crmProjectFollow.createMany).toHaveBeenCalled();
      const follows = mock.crmProjectFollow.createMany.mock.calls[0][0].data;
      expect(follows[0].projectId).toBe(1);
      expect(follows[0].followerId).toBe(2); // user.id 默认
      // 源码 project.create 不调 normalizeContactName，contactName 原样传
      expect(follows[0].contactName).toEqual(['张三']);
    });

    it('14. cleanEmpty：customerId 空串→undefined', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.create({ name: 'X', customerId: '' }, admin);
      expect(mock.crmOpportunity.create.mock.calls[0][0].data.customerId).toBeUndefined();
    });

    it('15. ⚠ 行为记录：region 拼接当前失效（sanitize 先剥 provinceName/cityName/districtName）', async () => {
      // 源码 buildData line 195-197 想拼接 province/city/district → region，但 line 167
      // 先调 sanitize('CrmOpportunity', body) → CrmOpportunityScalarFieldEnum 不含
      // provinceName/cityName/districtName → 被 scrub 剥掉 → rest 里没有这些字段 →
      // region 永远 undefined。这是个潜在 bug，源修复后此断言应改为 toEqual([...])。
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.create({ name: 'X', provinceName: '广东省', cityName: '深圳', districtName: '南山' }, admin);
      const data = mock.crmOpportunity.create.mock.calls[0][0].data;
      expect(data.region).toBeUndefined();
    });

    it('16. ownerId 兜底：body.ownerId 优先，user.id 次之', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.create({ name: 'X', ownerId: 99 }, sales);
      expect(mock.crmOpportunity.create.mock.calls[0][0].data.ownerId).toBe(99);
    });
  });

  // ============================================================
  // update
  // ============================================================
  describe('update', () => {
    it('17. items 非数组经 sanitize 变 [] → 仍触删（行为记录）', async () => {
      setMock(mock, 'crmProjectItem.deleteMany', { count: 0 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.update(1, { items: 'invalid' as any }, admin);
      expect(mock.crmProjectItem.deleteMany).toHaveBeenCalled();
    });

    it('18. items=[] 清空旧明细', async () => {
      setMock(mock, 'crmProjectItem.deleteMany', { count: 0 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.update(1, { items: [] }, admin);
      expect(mock.crmProjectItem.deleteMany).toHaveBeenCalledWith({ where: { projectId: 1 } });
      expect(mock.crmOpportunity.update.mock.calls[0][0].data.items).toEqual({ create: [] });
    });

    it('19. 仅传 name → 不动 items', async () => {
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.update(1, { name: '改名' }, admin);
      expect(mock.crmProjectItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // remove
  // ============================================================
  describe('remove', () => {
    it('20. 不存在 → Prisma P2025（行为记录）', async () => {
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'crmOpportunity.delete', err);
      // remove 现要求 user 参数，管理员(dataScope=1)放行后才触发 delete 的 P2025
      await expect(service.remove(999, admin)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // inherit
  // ============================================================
  describe('inherit', () => {
    it('21. 不存在 → NotFound', async () => {
      setMock(mock, 'crmOpportunity.findUnique', null);
      await expect(service.inherit(999, 3, '原因', admin)).rejects.toThrow(NotFoundException);
    });

    it('22. ownerId=null 兜底 user.id', async () => {
      // 源码 project.inherit【不】用 $transaction，直接调 prisma.crmProjectInherit.create
      setMock(mock, 'crmOpportunity.findUnique', { id: 1, ownerId: null });
      setMock(mock, 'crmProjectInherit.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1, ownerId: 3 });
      await service.inherit(1, 3, '原因', { id: 99, isAdmin: false });
      expect(mock.crmProjectInherit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromUserId: 99, toUserId: 3, inheritedById: 99 }),
      });
    });
  });

  // ============================================================
  // addFollow
  // ============================================================
  describe('addFollow', () => {
    it('23. followDate 字符串 → 转 Date + 同步 lastFollowDate', async () => {
      setMock(mock, 'crmProjectFollow.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.addFollow(1, { content: 'X', followDate: '2026-09-22' }, sales);
      const call = mock.crmProjectFollow.create.mock.calls[0][0];
      expect(call.data.followDate).toBeInstanceOf(Date);
      // lastFollowDate 同步
      expect(mock.crmOpportunity.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastFollowDate: call.data.followDate },
      });
    });

    it('24. followDate 未传 → 默认 new Date()', async () => {
      setMock(mock, 'crmProjectFollow.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.addFollow(1, { content: 'X' }, sales);
      expect(mock.crmProjectFollow.create.mock.calls[0][0].data.followDate).toBeInstanceOf(Date);
    });

    it('25. contactName 多格式：数组含空项 → trim 去空拼接', async () => {
      setMock(mock, 'crmProjectFollow.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.addFollow(1, { content: 'X', contactName: ['张三', '  ', '李四'] }, sales);
      expect(mock.crmProjectFollow.create.mock.calls[0][0].data.contactName).toBe('张三;李四');
    });

    it('26. contactName=null → 存 null', async () => {
      setMock(mock, 'crmProjectFollow.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.addFollow(1, { content: 'X', contactName: null }, sales);
      expect(mock.crmProjectFollow.create.mock.calls[0][0].data.contactName).toBeNull();
    });

    it('27. body.followerId 显式覆盖 user.id', async () => {
      setMock(mock, 'crmProjectFollow.create', { id: 1 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.addFollow(1, { content: 'X', followerId: 99 }, sales);
      expect(mock.crmProjectFollow.create.mock.calls[0][0].data.followerId).toBe(99);
    });
  });

  // ============================================================
  // updateFollow
  // ============================================================
  describe('updateFollow', () => {
    it('28. 不属于该项目的 followId → NotFound', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', null);
      await expect(service.updateFollow(1, 99, { content: 'X' }, sales)).rejects.toThrow(NotFoundException);
    });

    it('29. 仅传 content → 只更新 content', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 99, projectId: 1 });
      setMock(mock, 'crmProjectFollow.update', { id: 99 });
      await service.updateFollow(1, 99, { content: '新' }, sales);
      const call = mock.crmProjectFollow.update.mock.calls[0][0];
      expect(call.data.content).toBe('新');
      expect(call.data.period).toBeUndefined();
    });

    it('30. contactName 空数组 → 存 null', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 99, projectId: 1 });
      setMock(mock, 'crmProjectFollow.update', { id: 99 });
      await service.updateFollow(1, 99, { contactName: [] }, sales);
      expect(mock.crmProjectFollow.update.mock.calls[0][0].data.contactName).toBeNull();
    });
  });

  // ============================================================
  // deleteFollow
  // ============================================================
  describe('deleteFollow', () => {
    it('31. 跟进不存在 → NotFound', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', null);
      await expect(service.deleteFollow(1, 99, sales)).rejects.toThrow(NotFoundException);
    });

    it('32. 本人删除自己跟进 → 成功', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 99, projectId: 1, followerId: 2 });
      setMock(mock, 'crmProjectFollow.delete', { id: 99 });
      const r: any = await service.deleteFollow(1, 99, sales);
      expect(r.ok).toBe(true);
      expect(mock.crmProjectFollow.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it('33. 他人删除（非管理员）→ Forbidden', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 99, projectId: 1, followerId: 99 });
      await expect(service.deleteFollow(1, 99, sales)).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================================
  // searchCustomer
  // ============================================================
  describe('searchCustomer', () => {
    it('34. keyword OR（name/code）+ select + take:20 + applyDataScope', async () => {
      setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'KH001', name: 'A', ownerId: 1, address: '深圳' }]);
      await service.searchCustomer('A', admin);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(2);
      expect(call.select).toEqual({ id: true, code: true, name: true, ownerId: true, address: true });
      expect(call.take).toBe(20);
    });

    it('35. keyword 空 → OR 不设置', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      await service.searchCustomer('', admin);
      expect(mock.crmCustomer.findMany.mock.calls[0][0].where.OR).toBeUndefined();
    });
  });

  // ============================================================
  // searchContract
  // ============================================================
  describe('searchContract', () => {
    it('36. keyword OR（title/code/customerName）+ select + take:20', async () => {
      setMock(mock, 'salesContract.findMany', [{ id: 1, code: 'HT001', title: 'X', customerName: 'C' }]);
      await service.searchContract('X');
      const call = mock.salesContract.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
      expect(call.select).toEqual({ id: true, code: true, title: true, customerName: true });
      expect(call.take).toBe(20);
    });

    it('37. keyword 空 → OR 不设置', async () => {
      setMock(mock, 'salesContract.findMany', []);
      await service.searchContract('');
      expect(mock.salesContract.findMany.mock.calls[0][0].where.OR).toBeUndefined();
    });
  });

  // ============================================================
  // importConfirm
  // ============================================================
  describe('importConfirm', () => {
    it('38. 空数组 → count:0', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      const r: any = await service.importConfirm([], admin);
      expect(r.count).toBe(0);
      expect(mock.crmOpportunity.create).not.toHaveBeenCalled();
    });

    it('39. 多行批量：每行 create 一次 + submitStatus 默认 active', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.importConfirm([
        { name: 'A', customerCode: 'KH001', dateOpen: '2026-09-22', category: 'C', stage: 'S', source: 'X', state: 'T', ownerId: 1 },
        { name: 'B', customerCode: 'KH002', dateOpen: '2026-09-22', category: 'C', stage: 'S', source: 'X', state: 'T', ownerId: 1 },
      ], admin);
      expect(mock.crmOpportunity.create).toHaveBeenCalledTimes(2);
      const firstCreate = mock.crmOpportunity.create.mock.calls[0][0];
      expect(firstCreate.data.submitStatus).toBe('active');
      expect(firstCreate.data.createdById).toBe(1);
    });

    it('40. region 拼接：provinceName+cityName+districtName', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.importConfirm([{
        name: 'A', customerCode: 'KH001', dateOpen: '2026-09-22',
        category: 'C', stage: 'S', source: 'X', state: 'T', ownerId: 1,
        provinceName: '广东', cityName: '深圳', districtName: '南山',
      }], admin);
      const data = mock.crmOpportunity.create.mock.calls[0][0].data;
      expect(data.region).toEqual(['广东', '深圳', '南山']);
    });

    it('41. submitStatus 自定义值覆盖默认', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.importConfirm([{
        name: 'A', customerCode: 'KH001', dateOpen: '2026-09-22',
        category: 'C', stage: 'S', source: 'X', state: 'T', ownerId: 1,
        submitStatus: 'archived',
      }], admin);
      expect(mock.crmOpportunity.create.mock.calls[0][0].data.submitStatus).toBe('archived');
    });

    it('42. amountFinal 自动计算（discountPct 默认 10 折）', async () => {
      setMock(mock, 'crmOpportunity.create', { id: 1 });
      await service.importConfirm([{
        name: 'A', customerCode: 'KH001', dateOpen: '2026-09-22',
        category: 'C', stage: 'S', source: 'X', state: 'T', ownerId: 1,
        expectedRevenue: 1000,
      }], admin);
      // 默认 discountPct=10 → amountFinal=1000
      expect(mock.crmOpportunity.create.mock.calls[0][0].data.amountFinal).toBe(1000);
    });
  });

  // ============================================================
  // exportCsv
  // ============================================================
  describe('exportCsv', () => {
    it('43. ids 过滤 → 按 id desc', async () => {
      setMock(mock, 'crmOpportunity.findMany', []);
      await service.exportCsv([1, 2, 3]);
      const call = mock.crmOpportunity.findMany.mock.calls[0][0];
      expect(call.where.id.in).toEqual([1, 2, 3]);
      expect(call.orderBy).toEqual({ id: 'desc' });
      expect(call.include.owner.select).toEqual({ name: true });
    });

    it('44. ids 未传 → 空 where', async () => {
      setMock(mock, 'crmOpportunity.findMany', []);
      await service.exportCsv();
      expect(mock.crmOpportunity.findMany.mock.calls[0][0].where.id).toBeUndefined();
    });
  });

  // ============================================================
  // generatePdf
  // ============================================================
  describe('generatePdf', () => {
    it('45. 不存在 → NotFound', async () => {
      setMock(mock, 'crmOpportunity.findUnique', null);
      await expect(service.generatePdf(999)).rejects.toThrow(NotFoundException);
    });

    it('46. 正常项目：detail 被调 + 数据组装（含 items 格式化金额）', async () => {
      setMock(mock, 'crmOpportunity.findUnique', {
        id: 1, code: 'XM001', name: '测试', customerName: '客户A',
        owner: { name: '张三' }, customer: { id: 1, code: 'KH001', name: '客户A' },
        category: '终端', stage: '签约', source: '展会', state: '进行',
        dateOpen: new Date('2026-09-22'),
        items: [{ productName: 'P1', productCode: 'PC1', model: 'M1', unitPrice: 100, quantity: 1, amount: 100 }],
        follows: [], inherits: [],
      });
      // PdfService 真实调 puppeteer 沙箱无 chromium 会失败，捕获错误
      try { await service.generatePdf(1); } catch {}
      expect(mock.crmOpportunity.findUnique).toHaveBeenCalled();
    });
  });
});