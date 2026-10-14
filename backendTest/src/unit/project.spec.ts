/**
 * ProjectService 单元测试（覆盖 modules/project/project.service.ts）
 *
 * 直接实例化（仅依赖 PrismaService）。覆盖：
 *  - 纯函数：calcAmountFinal / buildProjectOrderBy / normalizeContactName（private，运行时可访问）
 *  - importPreview 必填校验
 *  - list / detail 基础路径
 *  - inherit（创建继承记录 + 改写 ownerId；源码当前【无】自身权限闸门，仅记录行为，见注释）
 *  - deleteFollow 删除权限（本人 / 管理员放行，他人 Forbidden）
 *
 * 文档 P2-2 用例据此编写，并纠正了文档中"inherit 应抛越权"的假设：
 * 源码 inherit 不校验调用者权限，测试验证其真实行为而非假设。
 */
import { ProjectService } from '@app/modules/project/project.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('ProjectService', () => {
  let service: ProjectService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new ProjectService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ---- 纯函数 calcAmountFinal ----
  describe('calcAmountFinal（折扣计算）', () => {
    it('1. 折率 10 → 原价', () => {
      expect((service as any).calcAmountFinal(100, 10)).toBe(100);
    });
    it('2. 折率 5 → 半价', () => {
      expect((service as any).calcAmountFinal(100, 5)).toBe(50);
    });
    it('3. 折率 8.5 → 85', () => {
      expect((service as any).calcAmountFinal(100, 8.5)).toBe(85);
    });
    it('4. expectedRevenue 为 null → null', () => {
      expect((service as any).calcAmountFinal(null, 10)).toBeNull();
    });
    it('5. 折率缺省（undefined）→ 按 10 折（原价）', () => {
      expect((service as any).calcAmountFinal(100, undefined)).toBe(100);
    });
  });

  // ---- 纯函数 buildProjectOrderBy ----
  describe('buildProjectOrderBy（列表排序安全回退）', () => {
    it('1. 合法字段 code → {code: so}', () => {
      expect((service as any).buildProjectOrderBy('code', 'asc')).toEqual({ code: 'asc' });
    });
    it('2. 非法字段 → 回退 {updatedAt: desc}', () => {
      expect((service as any).buildProjectOrderBy('notAField', 'desc')).toEqual({ updatedAt: 'desc' });
    });
    it('3. owner 映射到 owner.name', () => {
      expect((service as any).buildProjectOrderBy('owner', 'desc')).toEqual({ owner: { name: 'desc' } });
    });
  });

  // ---- 纯函数 normalizeContactName ----
  describe('normalizeContactName（联系人名规范化）', () => {
    it('1. null/undefined → null', () => {
      expect((service as any).normalizeContactName(null)).toBeNull();
      expect((service as any).normalizeContactName(undefined)).toBeNull();
    });
    it('2. 数组 → 分号拼接并去空', () => {
      expect((service as any).normalizeContactName(['a', 'b'])).toBe('a;b');
    });
    it('3. 字符串 → trim', () => {
      expect((service as any).normalizeContactName('  x  ')).toBe('x');
    });
    it('4. 含空元素的数组 → 过滤后拼接', () => {
      expect((service as any).normalizeContactName(['', 'a'])).toBe('a');
    });
    it('5. 空数组 → null', () => {
      expect((service as any).normalizeContactName([])).toBeNull();
    });
  });

  // ---- importPreview 必填校验 ----
  describe('importPreview（导入必填校验）', () => {
    const required = ['name', 'customerCode', 'dateOpen', 'category', 'stage', 'source', 'state', 'ownerId'];
    it('1. 必填齐全 → valid', async () => {
      const row: any = {};
      required.forEach((k) => (row[k] = 'v'));
      const r: any = await service.importPreview([row]);
      expect(r.validCount).toBe(1);
      expect(r.invalidCount).toBe(0);
    });
    it('2. 缺字段 → invalid 并标记 miss', async () => {
      const row: any = { name: 'x' }; // 其余缺
      const r: any = await service.importPreview([row]);
      expect(r.invalidCount).toBe(1);
      expect(r.invalid[0].miss).toEqual(required.filter((k) => k !== 'name'));
    });
  });

  // ---- list 基础路径（数组形式 $transaction）----
  it('list: $transaction 数组形式返回 total/items，inheritDate 兜底 null', async () => {
    setMock(mock, '$transaction', [2, [{ id: 1, name: '项目A' }, { id: 2, name: '项目B' }]]);
    setMock(mock, 'crmProjectInherit.findMany', []);
    const r: any = await service.list({ page: 1, pageSize: 10 }, { id: 1, isAdmin: true });
    expect(r.total).toBe(2);
    expect(r.items.length).toBe(2);
    expect(r.items[0].inheritDate).toBeNull();
  });

  // ---- detail ----
  it('detail: 不存在 → NotFoundException', async () => {
    setMock(mock, 'crmOpportunity.findUnique', null);
    await expect(service.detail(999)).rejects.toThrow('项目不存在');
  });

  // ---- inherit ----
  describe('inherit（项目继承/转交）', () => {
    it('1. 项目不存在 → NotFoundException', async () => {
      setMock(mock, 'crmOpportunity.findUnique', null);
      await expect(service.inherit(1, 7, '交接', { id: 5 })).rejects.toThrow('项目不存在');
    });

    it('2. 正常：创建继承记录并把 ownerId 改写为 toUserId', async () => {
      setMock(mock, 'crmOpportunity.findUnique', { id: 1, ownerId: 99 });
      setMock(mock, 'crmProjectInherit.create', { id: 10 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.inherit(1, 7, '交接', { id: 5 });
      // 创建继承记录：fromUserId=原 ownerId(99), toUserId=7, inheritedById=user.id(5)
      expect(mock.crmProjectInherit.create).toHaveBeenCalled();
      const createArg = mock.crmProjectInherit.create.mock.calls[0][0].data;
      expect(createArg).toMatchObject({ projectId: 1, fromUserId: 99, toUserId: 7, inheritedById: 5, reason: '交接' });
      // 改写 ownerId
      expect(mock.crmOpportunity.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ownerId: 7 } });
    });

    it('3. ⚠ 行为记录：源码 inherit 不校验调用者权限（任何用户均可转交，无越权闸门）', async () => {
      // 普通用户也能调用 inherit —— 这是源码现状（非权限正确实现），仅验证行为，不要求抛错
      setMock(mock, 'crmOpportunity.findUnique', { id: 1, ownerId: 99 });
      setMock(mock, 'crmProjectInherit.create', { id: 10 });
      setMock(mock, 'crmOpportunity.update', { id: 1 });
      await service.inherit(1, 7, '交接', { id: 5, isAdmin: false, roleCodes: ['sales'] });
      expect(mock.crmOpportunity.update).toHaveBeenCalled();
    });
  });

  // ---- deleteFollow 删除权限 ----
  describe('deleteFollow（跟进删除权限）', () => {
    it('1. 跟进不存在 → NotFoundException', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', null);
      await expect(service.deleteFollow(1, 5, { id: 5 })).rejects.toThrow('跟进记录不存在');
    });

    it('2. 本人删除 → 放行', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 5, followerId: 5 });
      setMock(mock, 'crmProjectFollow.delete', { id: 5 });
      const r: any = await service.deleteFollow(1, 5, { id: 5, isAdmin: false });
      expect(r.ok).toBe(true);
      expect(mock.crmProjectFollow.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('3. 他人删除（非管理员）→ ForbiddenException', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 5, followerId: 9 });
      await expect(service.deleteFollow(1, 5, { id: 5, isAdmin: false }))
        .rejects.toThrow('仅跟进创建人或管理员可删除');
      expect(mock.crmProjectFollow.delete).not.toHaveBeenCalled();
    });

    it('4. 管理员删除他人跟进 → 放行', async () => {
      setMock(mock, 'crmProjectFollow.findFirst', { id: 5, followerId: 9 });
      setMock(mock, 'crmProjectFollow.delete', { id: 5 });
      await service.deleteFollow(1, 5, { id: 5, isAdmin: true });
      expect(mock.crmProjectFollow.delete).toHaveBeenCalled();
    });
  });
});
