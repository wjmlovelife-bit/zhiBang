/**
 * FollowService 全场景补测（与现有 follow.service.spec.ts 1 用例 + follow.spec.ts 3 用例互补）
 *
 * follow.service.ts 仅一个方法：getContactsByFollower(followerId, user)
 * 当前缺测：
 *  - followerId 不存在 → 空数组
 *  - ownerId 过滤（applyDataScope）
 *  - take 限制（如有）
 *  - dataScope 注入（OR ownerId/createdById）
 *  - ⚠ 业务规则：源码无 addFollow（按文档记录）
 */
import { FollowService } from '@app/modules/follow/follow.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('FollowService extra scenarios', () => {
  let service: FollowService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new FollowService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // getContactsByFollower
  // ============================================================
  describe('getContactsByFollower', () => {
    it('1. 跨用户 followerId（非 admin）→ throw Forbidden', async () => {
      // 源码 line 23: 跨用户查询仅 admin 豁免 → throw ForbiddenException
      await expect(service.getContactsByFollower(99, { id: 1 })).rejects.toThrow('仅可查询自己的联系人池');
    });

    it('2. followerId=0 → 返回 []（短路）', async () => {
      const r: any = await service.getContactsByFollower(0, { id: 1 });
      expect(r).toEqual([]);
    });

    it('3. 多客户 contacts 合并（客户A 2 + 客户B 1 = 3 联系人）', async () => {
      setMock(mock, 'crmCustomer.findMany', [
        {
          id: 1, name: '客户A',
          contacts: [
            { id: 1, name: '李四', mobile: '138', department: '采购', position: '经理' },
            { id: 2, name: '王五', mobile: '139', department: '技术', position: '总监' },
          ],
        },
        {
          id: 2, name: '客户B',
          contacts: [
            { id: 3, name: '赵六', mobile: '150', department: '财务', position: '经理' },
          ],
        },
      ]);
      const r: any = await service.getContactsByFollower(2, { id: 2 });
      expect(r.length).toBe(3);
      expect(r[0].contactName).toBe('李四');
      expect(r[2].contactName).toBe('赵六');
    });

    it('4. 普通用户（非 admin）→ 走 ownerId=followerId 过滤（行为记录：源码不用 applyDataScope）', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      await service.getContactsByFollower(2, { id: 2 });
      // 第一次 crmCustomer.findMany 调用 where 是 { ownerId: 2 }
      const firstCall = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(firstCall.where.ownerId).toBe(2);
      expect(firstCall.select).toEqual({ id: true });
    });

    it('5. admin → 第一次查全部客户（where 为空）', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      await service.getContactsByFollower(2, { id: 1, isAdmin: true });
      const firstCall = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(firstCall.where).toBeUndefined();
    });

    it('6. customerIds 为空（无 owned 客户）→ 返回 []', async () => {
      setMock(mock, 'crmCustomer.findMany', []); // 第一次返回空
      const r: any = await service.getContactsByFollower(2, { id: 2 });
      expect(r).toEqual([]);
    });

    it('4. ⚠ 行为记录：源码无 addFollow 方法（follow CRUD 由 customer/project service 提供）', () => {
      // FollowService 只有一个方法 getContactsByFollower；addFollow 在 customer/project 内
      // 此处仅声明文档假设与源码实际的对齐
      expect(typeof (service as any).addFollow).toBe('undefined');
    });
  });
});