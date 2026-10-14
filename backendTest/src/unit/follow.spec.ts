/**
 * FollowService.getContactsByFollower 扩展测试（覆盖 modules/follow/follow.service.ts）
 *
 * 直接实例化（仅依赖 PrismaService）。验证：admin 看全公司、普通用户仅看自己 owner 的客户、
 * 跨用户查询（followerId !== user.id 且非 admin）抛 ForbiddenException。
 * 注：源码无 addFollow 方法，故未覆盖文档 P2-5 用例 4/5（不存在）。
 */
import { FollowService } from '@app/modules/follow/follow.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('FollowService.getContactsByFollower', () => {
  let service: FollowService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new FollowService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  const ownedCustomer = {
    id: 100, name: '客户A',
    contacts: [{ id: 1, name: '李四', mobile: '138', department: '采购', position: '经理' }],
  };

  it('1. admin 看全公司所有客户联系人', async () => {
    setMock(mock, 'crmCustomer.findMany', [ownedCustomer]);
    const r: any = await service.getContactsByFollower(2, { id: 2, isAdmin: true });
    expect(r.length).toBe(1);
    expect(r[0].customerId).toBe(100);
    expect(r[0].contactName).toBe('李四');
  });

  it('2. 普通用户仅看自己 owner 的客户', async () => {
    setMock(mock, 'crmCustomer.findMany', [ownedCustomer]);
    const r: any = await service.getContactsByFollower(2, { id: 2, isAdmin: false });
    expect(r.length).toBe(1);
    const call = mock.crmCustomer.findMany.mock.calls[0][0];
    expect(call.where.ownerId).toBe(2);
  });

  it('3. followerId !== user.id（非 admin）→ 抛 ForbiddenException', async () => {
    await expect(service.getContactsByFollower(999, { id: 2, isAdmin: false }))
      .rejects.toThrow();
  });
});
