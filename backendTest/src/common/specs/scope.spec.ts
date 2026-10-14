/**
 * 数据范围 scope 单元测试（覆盖 common/scope.ts: applyDataScope 五分支 + getDeptSubtreeIds）
 *
 * 说明：applyDataScope(prisma, user, baseWhere, options?) 的判定依据是 user.dataScope：
 *   1 全部 / 4 本人 / 2 本部门及下级 / 3 本部门 / 5 自定义部门。
 * getDeptSubtreeIds 源码无防环保护（自环会无限递归），故不测其防环用例（需源修复）。
 */
import { applyDataScope, getDeptSubtreeIds } from '@app/common/scope';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../../setup/prisma-mock';

describe('scope / applyDataScope', () => {
  let mock: MockPrisma;
  beforeEach(() => { mock = makeMockPrisma(); });
  afterEach(() => resetMockPrisma(mock));

  it('1. dataScope=1（全部）→ 原样返回 where', async () => {
    const out = await applyDataScope(mock as any, { dataScope: 1 }, { name: 'A' });
    expect(out).toEqual({ name: 'A' });
  });

  it('2. dataScope=3（本部门）→ deptId in [deptId]', async () => {
    const out = await applyDataScope(mock as any, { dataScope: 3, deptId: 5 }, {});
    expect(out).toEqual({ deptId: { in: [5] } });
  });

  it('3. dataScope=2（本部门及下级）→ deptId in [子树]', async () => {
    setMock(mock, 'sysDept.findMany', [
      { id: 5, parentId: null },
      { id: 6, parentId: 5 },
      { id: 7, parentId: 6 },
    ]);
    const out = await applyDataScope(mock as any, { dataScope: 2, deptId: 5 }, {});
    expect(out).toEqual({ deptId: { in: [5, 6, 7] } });
  });

  it('4. dataScope=4（本人）→ OR [ownerId, createdById]', async () => {
    const out = await applyDataScope(mock as any, { dataScope: 4, id: 2 }, {});
    expect(out).toEqual({ OR: [{ ownerId: 2 }, { createdById: 2 }] });
  });

  it('5. dataScope=5（自定义部门）→ deptId in customDeptIds', async () => {
    const out = await applyDataScope(mock as any, { dataScope: 5, customDeptIds: [3, 4] }, {});
    expect(out).toEqual({ deptId: { in: [3, 4] } });
  });

  it('6. 无 user → 返回 {} 不报错', async () => {
    const out = await applyDataScope(mock as any, undefined, {});
    expect(out).toEqual({});
  });

  it('7. dataScope=4 合并已有 where', async () => {
    const out = await applyDataScope(mock as any, { dataScope: 4, id: 2 }, { name: 'A' });
    expect(out).toEqual({ name: 'A', OR: [{ ownerId: 2 }, { createdById: 2 }] });
  });

  it('8. admin 无 dataScope → 原样返回', async () => {
    const out = await applyDataScope(mock as any, { isAdmin: true }, { x: 1 });
    expect(out).toEqual({ x: 1 });
  });
});

describe('scope / getDeptSubtreeIds', () => {
  let mock: MockPrisma;
  beforeEach(() => { mock = makeMockPrisma(); });
  afterEach(() => resetMockPrisma(mock));

  it('9. 单层 → [root]', async () => {
    setMock(mock, 'sysDept.findMany', [{ id: 5, parentId: null }]);
    expect(await getDeptSubtreeIds(mock as any, 5)).toEqual([5]);
  });

  it('10. 两层 → [5,6,7]', async () => {
    setMock(mock, 'sysDept.findMany', [
      { id: 5, parentId: null },
      { id: 6, parentId: 5 },
      { id: 7, parentId: 6 },
    ]);
    expect(await getDeptSubtreeIds(mock as any, 5)).toEqual([5, 6, 7]);
  });

  it('11. 无 deptId → []', async () => {
    expect(await getDeptSubtreeIds(mock as any, null)).toEqual([]);
  });
});
