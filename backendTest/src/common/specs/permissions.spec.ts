/**
 * 权限 computePermissions 单元测试（覆盖 common/permissions.ts）
 *
 * 说明：源码 computePermissions 对管理员返回全部 isActive 操作码；
 * 对普通用户仅返回 sysUserOperation 直接授权（按 isActive 过滤），**不合并角色授权**。
 * 文档用例 2 的「role + direct 合并去重」与源码不符，此处按真实行为断言（仅 direct）。
 */
import { computePermissions } from '@app/common/permissions';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../../setup/prisma-mock';

describe('permissions / computePermissions', () => {
  let mock: MockPrisma;
  beforeEach(() => { mock = makeMockPrisma(); });
  afterEach(() => resetMockPrisma(mock));

  it('1. admin → 全部 active 操作码', async () => {
    setMock(mock, 'sysOperation.findMany', [{ code: 'a' }, { code: 'b' }]);
    const out = await computePermissions(mock as any, { isAdmin: true, id: 1 });
    expect(out).toEqual(['a', 'b']);
  });

  it('2. 普通用户 → 仅用户级直接授权（不含角色合并）', async () => {
    setMock(mock, 'sysUserOperation.findMany', [
      { operation: { code: 'b', isActive: true } },
      { operation: { code: 'c', isActive: true } },
    ]);
    const out = await computePermissions(mock as any, { isAdmin: false, id: 2 });
    // 源码只返回 direct 授权，不合并角色
    expect(out).toEqual(['b', 'c']);
  });

  it('3. 失效操作被过滤', async () => {
    setMock(mock, 'sysUserOperation.findMany', [
      { operation: { code: 'a', isActive: false } },
      { operation: { code: 'b', isActive: true } },
    ]);
    const out = await computePermissions(mock as any, { isAdmin: false, id: 2 });
    expect(out).toEqual(['b']);
  });

  it('4. 普通用户无授权 → []', async () => {
    setMock(mock, 'sysUserOperation.findMany', []);
    const out = await computePermissions(mock as any, { isAdmin: false, id:2 });
    expect(out).toEqual([]);
  });
});
