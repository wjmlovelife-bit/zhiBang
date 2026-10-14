/**
 * CustomerService 单元测试（mock Prisma）
 * 覆盖：
 * 1. list: 查询 + 分页 + 排序
 * 2. list: dataScope 隔离
 * 3. detail: 不存在 → 404
 * 4. detail: 包含 follows/contacts/inherits
 * 5. detail: inherits 含用户名
 * 6. create: 必填 code 自动生成
 * 7. update: contacts 数组整组重写 + 字段剥除
 * 8. inherit: 写入继承历史 + 改 ownerId
 * 9. follow CRUD: add/update/delete + 权限校验
 * 10. search: 关键字 + dataScope
 * 11. sanitize: payload 净化（空串 → undefined）
 */
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CustomerService } from '@app/modules/customer/customer.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('CustomerService', () => {
  let service: CustomerService;
  let mock: MockPrisma;
  const adminUser = { id: 1, isAdmin: true, deptId: null };
  const salesUser = { id: 2, isAdmin: false, deptId: 2, dataScope: 4 };

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<CustomerService>(CustomerService);
    // 默认 mock：applyDataScope 返回 where
    setMock(mock, 'sysUser.findMany', []);
    setMock(mock, 'sysDept.findMany', []);
    setMock(mock, 'crmCustomerInherit.findMany', []);
    setMock(mock, 'sysRole.findMany', []);
  });

  afterEach(() => resetMockPrisma(mock));

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    it('1. should query with keyword + paginate + sort', async () => {
      // service.list 用 $transaction([count, findMany]) 数组形式
      setMock(mock, '$transaction', [25, [{ id: 1, name: '客户A' }, { id: 2, name: '客户B' }]]);
      const result = await service.list(
        {
          keyword: '客户', category: '终端', followStage: '高', industry: '电子', ownerId: 2,
          page: 2, pageSize: 10, sortField: 'updatedAt', sortOrder: 'desc',
        },
        adminUser,
      );
      expect(result.total).toBe(25);
      expect(result.items.length).toBe(2);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('2. should apply dataScope for non-admin (dataScope=4 本人)', async () => {
      setMock(mock, '$transaction', [1, [{ id: 1, name: '本人客户' }]]);
      await service.list({}, salesUser);
      expect(mock.$transaction).toHaveBeenCalled();
    });

    it('2b. should clamp pageSize to 1000 max', async () => {
      setMock(mock, '$transaction', [5000, []]);
      const result = await service.list({ page: 1, pageSize: 5000 }, adminUser);
      expect(result.pageSize).toBe(1000);
    });
  });

  // ============================================================
  // detail
  // ============================================================
  describe('detail', () => {
    it('3. should throw NotFoundException when customer not found', async () => {
      setMock(mock, 'crmCustomer.findUnique', null);
      await expect(service.detail(999)).rejects.toThrow(NotFoundException);
    });

    it('4. should return customer with contacts/follows/inherits', async () => {
      const fake = {
        id: 1, name: '客户A', contacts: [{ id: 1, name: '李四' }],
        follows: [{ id: 1, content: '测试' }],
        inherits: [],
      };
      setMock(mock, 'crmCustomer.findUnique', fake);
      const result = await service.detail(1);
      expect(result.id).toBe(1);
      expect(result.contacts.length).toBe(1);
    });

    it('5. should enrich inherits with user names', async () => {
      const fake = {
        id: 1, name: '客户A', contacts: [],
        follows: [],
        inherits: [{ id: 10, customerId: 1, fromUserId: 2, toUserId: 3, inheritedById: 1 }],
      };
      setMock(mock, 'crmCustomer.findUnique', fake);
      setMock(mock, 'sysUser.findMany', [
        { id: 2, name: '张三' }, { id: 3, name: '李四' }, { id: 1, name: '王五' },
      ]);
      const result: any = await service.detail(1);
      expect(result.inherits[0].fromUser.name).toBe('张三');
      expect(result.inherits[0].toUser.name).toBe('李四');
      expect(result.inherits[0].inheritedBy.name).toBe('王五');
    });
  });

  // ============================================================
  // create / update / remove
  // ============================================================
  describe('create', () => {
    it('6. should auto-generate code via nextCode', async () => {
      setMock(mock, 'crmCustomer.findFirst', null); // nextCode: 查最大 code
      setMock(mock, 'crmCustomer.create', { id: 999, code: 'KH202609200001' });
      const result = await service.create(
        { name: '新客户', category: '终端', followStage: '高' },
        adminUser,
      );
      expect(result.id).toBe(999);
      // 验证 create 被调用
      const call = mock.crmCustomer.create.mock.calls[0][0];
      // nextCode 用当前日期生成
      const today = new Date();
      const codePrefix = `KH${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      expect(call.data.code).toMatch(new RegExp(`^${codePrefix}\\d{4}$`));
    });
  });

  describe('update', () => {
    it('7. should replace contacts array (delete + create) and strip forbidden fields', async () => {
      let captured: any;
      // $transaction 用 callback 形式，必须 mockImplementation 真正执行回调
      mock.$transaction.mockImplementation(async (cb: any) =>
        cb({
          crmContact: { deleteMany: async () => ({ count: 2 }) },
          crmCustomer: {
            update: async (args: any) => {
              captured = args;
              return { id: 1, contacts: [] };
            },
          },
        }),
      );
      const result = await service.update(1, {
        name: '改', contacts: [
          { id: 999, customerId: 1, name: '李四' }, // 应被剥掉 id + customerId
          { name: '王五' },
        ],
      }, adminUser);
      expect(result.id).toBe(1);
      expect(mock.$transaction).toHaveBeenCalled();
      // contacts 整组重写：剥掉 id/customerId/createdAt/updatedAt
      expect(captured.data.contacts.create).toBeDefined();
      expect(captured.data.contacts.create.length).toBe(2);
      expect(captured.data.contacts.create[0]).toEqual({ name: '李四' });
      expect(captured.data.contacts.create[1]).toEqual({ name: '王五' });
      // 系统自动管理字段不得写入 Prisma
      expect(captured.data.id).toBeUndefined();
      expect(captured.data.createdAt).toBeUndefined();
    });
  });

  // ============================================================
  // inherit
  // ============================================================
  describe('inherit', () => {
    it('8. should write inherit history and update ownerId', async () => {
      setMock(mock, 'crmCustomer.findUnique', { id: 1, ownerId: 2 });
      // $transaction 用 callback 形式，必须 mockImplementation 真正执行回调
      mock.$transaction.mockImplementation(async (cb: any) => cb({
        crmCustomerInherit: { create: async () => ({ id: 1 }) },
        crmCustomer: { update: async () => ({ id: 1, ownerId: 3 }) },
      }));
      const result = await service.inherit(1, 3, '原因', adminUser);
      expect(result.ownerId).toBe(3);
    });
  });

  // ============================================================
  // follow CRUD
  // ============================================================
  describe('follows', () => {
    it('9a. addFollow should create with default values', async () => {
      setMock(mock, 'crmCustomerFollow.create', { id: 99, content: '测试' });
      const result = await service.addFollow(1, { content: '测试', contactName: ['张三', '李四'] }, salesUser);
      expect(result.id).toBe(99);
      // 验证 contactName 已拼接为 "张三;李四"
      const call = mock.crmCustomerFollow.create.mock.calls[0][0];
      expect(call.data.contactName).toBe('张三;李四');
      expect(call.data.customerId).toBe(1);
      expect(call.data.followerId).toBe(2);
    });

    it('9b. updateFollow should throw NotFound if followId not in customer', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', null);
      await expect(service.updateFollow(1, 99, { content: 'x' }, salesUser)).rejects.toThrow(NotFoundException);
    });

    it('9c. deleteFollow should throw Forbidden if not owner and not admin', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', { id: 99, customerId: 1, followerId: 99 }); // 非当前用户
      await expect(service.deleteFollow(1, 99, salesUser)).rejects.toThrow(ForbiddenException);
    });

    it('9d. deleteFollow should allow admin to delete any', async () => {
      setMock(mock, 'crmCustomerFollow.findFirst', { id: 99, customerId: 1, followerId: 99 });
      setMock(mock, 'crmCustomerFollow.delete', { id: 99 });
      const result = await service.deleteFollow(1, 99, adminUser);
      expect(result.ok).toBe(true);
    });
  });

  // ============================================================
  // search
  // ============================================================
  describe('search', () => {
    it('10. should query with OR condition on name/code', async () => {
      setMock(mock, 'crmCustomer.findMany', [{ id: 1, code: 'KH001', name: '测试' }]);
      const result: any = await service.search('测试', salesUser);
      expect(result.length).toBe(1);
      const call = mock.crmCustomer.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });
  });

  // ============================================================
  // sanitize: payload.ts 净化
  // ============================================================
  describe('sanitize (payload utility)', () => {
    it('11. should strip empty string to undefined for Int?/Decimal? fields', async () => {
      // 直接调 service.create 走 sanitize + cleanEmpty
      setMock(mock, 'crmCustomer.findFirst', null);
      setMock(mock, 'crmCustomer.create', { id: 1 });
      await service.create({
        name: 'X',
        paymentLimitPct: '',  // 空串应被剥掉
        registeredCapital: null,  // null 应被剥掉
        sharedUserIds: [1, 2, ''],  // 数组应被清理
      }, adminUser);
      const call = mock.crmCustomer.create.mock.calls[0][0];
      expect(call.data.paymentLimitPct).toBeUndefined();
      expect(call.data.registeredCapital).toBeUndefined();
      // cleanArrayFields 对数组字段：原样保留（含前端误传的 '')
      expect(call.data.sharedUserIds).toEqual([1, 2, '']);
    });
  });
});
