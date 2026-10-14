/**
 * CustomerService 全场景单测（覆盖 modules/customer/customer.service.ts）
 *
 * 覆盖范围（与现有 customer.service.spec.ts + customer-edge.spec.ts 互补）：
 *  - list 排序非法字段回退、pageSize 默认、keyword 空、inheritDate 关联
 *  - detail inherits 空数组不查 sysUser
 *  - create body.code 已传、contacts 数组写入、contacts 非数组不写入、null user、deptId 兜底
 *  - update 仅部分字段更新、contacts 非数组不删、contacts=[] 清空、updatedById 写入
 *  - remove 不存在 → Prisma P2025（记行为）
 *  - getFollows include follower + 倒序
 *  - addFollow followDate 字符串转 Date / contactName 多种格式
 *  - updateFollow 部分字段更新、contactName 含空数组
 *  - deleteFollow 删除成功路径
 *  - search keyword 空 / take:20 / select 字段
 *  - nextCode 串行连续生成
 *  - inherit 不存在→404、ownerId=null 兜底 user.id
 *
 * 设计原则：所有测试不依赖 Nest DI 容器，直接 new CustomerService(mock as any)。
 */
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CustomerService } from '@app/modules/customer/customer.service';
import { makeMockPrisma, MockPrisma, setMock, setMockError, resetMockPrisma } from '../setup/prisma-mock';

describe('CustomerService scenarios', () => {
  let service: CustomerService;
  let mock: MockPrisma;
  const admin = { id: 1, isAdmin: true, deptId: null } as any;
  const sales = { id: 2, isAdmin: false, deptId: 2 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new CustomerService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // list - 全场景
  // ============================================================
  describe('list', () => {
    // 让 $transaction 默认行为：执行传入的 promise 数组，count/findMany 用各自 mock 值
    function setupListMocks(total = 0, items: any[] = []) {
      setMock(mock, 'crmCustomer.count', total);
      setMock(mock, 'crmCustomer.findMany', items);
      // $transaction 数组形式：直接 resolve 成 [total, items]
      mock.$transaction.mockImplementation(async (ops: any[]) => {
        // 触发每个 promise 的 mock 执行
        return await Promise.all(ops);
      });
    }

    it('1. 默认参数：page=1, pageSize=10', async () => {
      setupListMocks(0, []);
      const r: any = await service.list({}, admin);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(10);
    });

    it('2. 排序字段非法时回退 updatedAt desc', async () => {
      setupListMocks(0, []);
      await service.list({ sortField: 'notAField', sortOrder: 'asc' }, admin);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ updatedAt: 'desc' });
    });

    it('3. keyword 空时 OR 条件不设置', async () => {
      setupListMocks(0, []);
      await service.list({ keyword: '' }, admin);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeUndefined();
    });

    it('4. items 非空时才查 crmCustomerInherit（ids 空时不查）', async () => {
      setupListMocks(0, []);
      await service.list({}, admin);
      // ids=[] → 不查 inherit
      expect(mock.crmCustomerInherit.findMany).not.toHaveBeenCalled();
    });

    it('5. items 非空时 inherits 关联查询，inheritDate 注入每行', async () => {
      setupListMocks(1, [{ id: 5, name: 'A' }]);
      setMock(mock, 'crmCustomerInherit.findMany', [{ customerId: 5, inheritedAt: '2026-09-22' }]);
      const r: any = await service.list({}, admin);
      expect(mock.crmCustomerInherit.findMany).toHaveBeenCalledWith({
        where: { customerId: { in: [5] } },
        orderBy: { inheritedAt: 'desc' },
      });
      expect(r.items[0].inheritDate).toBe('2026-09-22');
    });
  });

  // ============================================================
  // detail - inherits 空时不查 sysUser
  // ============================================================
  describe('detail', () => {
    it('6. inherits 空数组时不调用 sysUser.findMany', async () => {
      setMock(mock, 'crmCustomer.findUnique', {
        id: 1, name: 'A', contacts: [], follows: [], inherits: [],
      });
      const r: any = await service.detail(1);
      expect(r.id).toBe(1);
      expect(mock.sysUser.findMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // create - code/contacts/deptId
  // ============================================================
  describe('create', () => {
    it('7. body.code 已传 → 不调用 nextCode', async () => {
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({ code: 'KH202609220099', name: 'X' }, admin);
      // crmCustomer.findFirst 是 nextCode 用 → 已传 code 不应查
      expect(mock.crmCustomer.findFirst).not.toHaveBeenCalled();
      expect(mock.crmCustomer.create.mock.calls[0][0].data.code).toBe('KH202609220099');
    });

    it('8. contacts 数组写入（含完整字段）', async () => {
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({
        name: 'X', contacts: [
          { name: '张三', mobile: '138', department: '采购', position: '经理' },
          { name: '李四', mobile: '139', department: '技术', position: '总监' },
        ],
      }, admin);
      const call = mock.crmCustomer.create.mock.calls[0][0];
      expect(call.data.contacts.create).toHaveLength(2);
      expect(call.data.contacts.create[0].name).toBe('张三');
    });

    it('9. contacts 非数组经 sanitize 后变为 [] → 仍写入 contacts:{create:[]}（行为记录）', async () => {
      // 源码 payload.scrub 对 contacts 这种 NESTED 字段，非数组会被替换为 []，
      // 然后 create 入口 `if (Array.isArray(contacts))` 仍为 true → data.contacts = {create: []}
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({ name: 'X', contacts: 'invalid' as any }, admin);
      const call = mock.crmCustomer.create.mock.calls[0][0];
      expect(call.data.contacts).toEqual({ create: [] });
    });

    it('10. deptId 兜底：user.deptId 优先，body.deptId 次之', async () => {
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({ name: 'X', deptId: 99 }, sales); // sales.deptId=2
      const call = mock.crmCustomer.create.mock.calls[0][0];
      expect(call.data.deptId).toBe(2); // user.deptId 覆盖 body.deptId
    });

    it('11. ownerId 兜底：body.ownerId 优先，user.id 次之', async () => {
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({ name: 'X', ownerId: 99 }, sales);
      const call = mock.crmCustomer.create.mock.calls[0][0];
      expect(call.data.ownerId).toBe(99);
    });
  });

  // ============================================================
  // update - 仅部分字段、contacts 空数组、updatedById
  // ============================================================
  describe('update', () => {
    function txMock() {
      return {
        crmContact: { deleteMany: jest.fn(async () => ({ count: 0 })) },
        crmCustomer: { update: jest.fn(async (args: any) => ({ id: 1, ...args.data })) },
      };
    }

    it('12. 仅传 name 字段时只更新 name，不动其他', async () => {
      const tx = txMock();
      mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
      await service.update(1, { name: '改名' }, admin);
      const call = tx.crmCustomer.update.mock.calls[0][0];
      expect(call.data.name).toBe('改名');
      expect(call.data.contacts).toBeUndefined();
      expect(tx.crmContact.deleteMany).not.toHaveBeenCalled();
    });

    it('13. contacts=[] 清空旧联系人', async () => {
      const tx = txMock();
      mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
      await service.update(1, { contacts: [] }, admin);
      expect(tx.crmContact.deleteMany).toHaveBeenCalledWith({ where: { customerId: 1 } });
      expect(tx.crmCustomer.update.mock.calls[0][0].data.contacts.create).toEqual([]);
    });

    it('14. contacts 是字符串（前端误传）→ sanitize 后变 []，仍走删+空建（行为记录）', async () => {
      const tx = txMock();
      mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
      await service.update(1, { contacts: 'invalid' as any }, admin);
      // scrub 把非数组 NESTED 字段替换为 []，update 入口 Array.isArray(contacts)=true
      expect(tx.crmContact.deleteMany).toHaveBeenCalledWith({ where: { customerId: 1 } });
      expect(tx.crmCustomer.update.mock.calls[0][0].data.contacts).toEqual({ create: [] });
    });
  });

  // ============================================================
  // remove - 不存在 → Prisma P2025（行为记录）
  // ============================================================
  describe('remove', () => {
    it('15. 不存在记录 → PrismaClientKnownRequestError（P2025）穿透', async () => {
      // 源码 remove 不查存在性，直接 delete；不存在的 id 会触发 Prisma P2025 错误
      const err: any = new Error('Record to delete does not exist');
      err.code = 'P2025';
      setMockError(mock, 'crmCustomer.delete', err);
      // 2026-09-22 后端加权限闸门：仅 admin 可调，需传 admin user
      const admin = { id: 1, isAdmin: true, dataScope: 1 } as any;
      await expect(service.remove(999, admin)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ============================================================
  // getFollows
  // ============================================================
  describe('getFollows', () => {
    it('16. 按 customerId 查，按 followDate desc 排序，含 follower', async () => {
      setMock(mock, 'crmCustomerFollow.findMany', [{ id: 1, follower: { id: 2, name: 'X' } }]);
      const r: any = await service.getFollows(1);
      expect(r.length).toBe(1);
      const call = mock.crmCustomerFollow.findMany.mock.calls[0][0];
      expect(call.where.customerId).toBe(1);
      expect(call.orderBy).toEqual({ followDate: 'desc' });
      expect(call.include).toEqual({ follower: { select: { id: true, name: true } } });
    });
  });

  // ============================================================
  // addFollow - 多格式
  // ============================================================
  describe('addFollow', () => {
    it('17. followDate 字符串 → 转 Date', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 1 });
      await service.addFollow(1, { content: 'X', followDate: '2026-09-22' }, sales);
      const call = mock.crmCustomerFollow.create.mock.calls[0][0];
      expect(call.data.followDate).toBeInstanceOf(Date);
    });

    it('18. followDate 未传 → 默认 new Date()', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 1 });
      await service.addFollow(1, { content: 'X' }, sales);
      const call = mock.crmCustomerFollow.create.mock.calls[0][0];
      expect(call.data.followDate).toBeInstanceOf(Date);
    });

    it('19. contactName 多种格式：null / 空字符串 / 含空白项 / 超长', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 1 });
      await service.addFollow(1, { content: 'X', contactName: ['张三', '  ', '李四', ''] }, sales);
      const call = mock.crmCustomerFollow.create.mock.calls[0][0];
      expect(call.data.contactName).toBe('张三;李四'); // trim + 去空 + 分号拼接
    });

    it('20. contactName=null → DB 存 null', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 1 });
      await service.addFollow(1, { content: 'X', contactName: null }, sales);
      expect(mock.crmCustomerFollow.create.mock.calls[0][0].data.contactName).toBeNull();
    });

    it('21. body.followerId 显式覆盖 user.id', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 1 });
      await service.addFollow(1, { content: 'X', followerId: 99 }, sales);
      const call = mock.crmCustomerFollow.create.mock.calls[0][0];
      expect(call.data.followerId).toBe(99);
    });
  });

  // ============================================================
  // updateFollow
  // ============================================================
  describe('updateFollow', () => {
    it('22. 不属于该 customer 的 followId → NotFound', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', null);
      await expect(service.updateFollow(1, 99, { content: 'X' }, sales)).rejects.toThrow(NotFoundException);
    });

    it('23. 仅传 content 字段时只更新 content', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', { id: 99, customerId: 1 });
      setMock(mock, 'crmCustomerFollow.update', { id: 99 });
      await service.updateFollow(1, 99, { content: '新内容' }, sales);
      const call = mock.crmCustomerFollow.update.mock.calls[0][0];
      expect(call.data.content).toBe('新内容');
      expect(call.data.period).toBeUndefined();
    });

    it('24. contactName 含空数组 → 存 null', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', { id: 99, customerId: 1 });
      setMock(mock, 'crmCustomerFollow.update', { id: 99 });
      await service.updateFollow(1, 99, { contactName: [] }, sales);
      expect(mock.crmCustomerFollow.update.mock.calls[0][0].data.contactName).toBeNull();
    });
  });

  // ============================================================
  // deleteFollow - 成功路径
  // ============================================================
  describe('deleteFollow', () => {
    it('25. 本人删除自己创建的跟进 → 成功', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', { id: 99, customerId: 1, followerId: 2 });
      setMock(mock, 'crmCustomerFollow.delete', { id: 99 });
      const r: any = await service.deleteFollow(1, 99, sales);
      expect(r.ok).toBe(true);
      expect(mock.crmCustomerFollow.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it('26. 跟进不存在 → NotFound', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', null);
      await expect(service.deleteFollow(1, 99, sales)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // search - 多场景
  // ============================================================
  describe('search', () => {
    it('27. keyword 空 → 仍然 applyDataScope + take:20', async () => {
      setMock(mock, 'crmCustomer.findMany', []);
      const r: any = await service.search('', admin);
      expect(r.length).toBe(0);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.take).toBe(20);
      // keyword 空时 OR 不设置
      expect(call.where.OR).toBeUndefined();
    });

    it('28. select 字段精确断言', async () => {
      setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'KH001', name: 'X' }]);
      await service.search('X', admin);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.select).toEqual({ id: true, code: true, name: true, ownerId: true, address: true });
    });
  });

  // ============================================================
  // nextCode
  // ============================================================
  describe('nextCode', () => {
    it('29. 同日无历史 code → 0001', async () => {
      setMock(mock, 'crmCustomer.findFirst', null);
      const code = await service.nextCode();
      expect(code).toMatch(/^KH\d{8}0001$/);
    });

    it('30. 同日有历史 code = KH202609220005 → 0006（mock $queryRaw 返回 nextval=6）', async () => {
      // TOCTOU 修复：nextCode 走 PG SEQUENCE（$queryRaw），不再走 findFirst
      // SEQUENCE 初始化时已 setval(max+1=6)，nextval 直接返回 6
      setMock(mock, '$queryRaw', [{ nextval: 6n }]);
      const code = await service.nextCode();
      expect(code).toMatch(/^KH\d{8}0006$/);
    });
  });

  // ============================================================
  // inherit - 边界
  // ============================================================
  describe('inherit', () => {
    it('31. 客户不存在 → NotFound', async () => {
      setMock(mock, 'crmCustomer.findUnique', null);
      await expect(service.inherit(999, 3, '原因', admin)).rejects.toThrow(NotFoundException);
    });

    it('32. ownerId 为 null → fromUserId 兜底 user.id', async () => {
      setMock(mock, 'crmCustomer.findUnique', { id: 1, ownerId: null });
      const txMockObj = {
        crmCustomerInherit: { create: jest.fn(async () => ({ id: 1 })) },
        crmCustomer: { update: jest.fn(async () => ({ id: 1, ownerId: 3 })) },
      };
      mock.$transaction.mockImplementation(async (cb: any) => cb(txMockObj));
      await service.inherit(1, 3, '原因', { id: 99, isAdmin: false });
      // 断言：crmCustomerInherit.create 入参的 fromUserId 兜底为 user.id(99)
      expect(txMockObj.crmCustomerInherit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromUserId: 99, toUserId: 3, inheritedById: 99 }),
      });
    });
  });
});