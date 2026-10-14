/**
 * CustomerService 边界用例（覆盖 modules/customer/customer.service.ts: update / remove）
 *
 * 直接实例化（仅依赖 PrismaService）。验证：
 * - update 无 contacts 时不删旧联系人
 * - update 经 sanitize 剥离未知字段
 * - update 经 cleanEmpty 将 Decimal? 空串字段转 undefined
 * - update 写入 updatedById = user.id
 * - remove 直接调用 crmCustomer.delete
 * 注：源码 remove 不预先查存在性，故不抛 NotFound（与文档 P2-1 用例 7 不符，按真实行为测）。
 * nextCode 并发（用例 8）需真实 DB，属集成范畴，未在此覆盖。
 */
import { CustomerService } from '@app/modules/customer/customer.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('CustomerService edge', () => {
  let service: CustomerService;
  let mock: MockPrisma;
  const user = { id: 3, isAdmin: false, deptId: 1 } as any;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new CustomerService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  function txMock() {
    return {
      crmContact: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      crmCustomer: { update: jest.fn(async (args: any) => ({ id: 1, contacts: [], ...args.data })) },
    };
  }

  it('1. update 无 contacts 字段时不删旧联系人', async () => {
    const tx = txMock();
    mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
    await service.update(1, { name: '改' }, user);
    expect(tx.crmContact.deleteMany).not.toHaveBeenCalled();
    expect(tx.crmCustomer.update).toHaveBeenCalled();
  });

  it('2. update 自动剥离未知字段（sanitize）', async () => {
    const tx = txMock();
    mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
    await service.update(1, { name: '改', hack: 'x' } as any, user);
    const call = tx.crmCustomer.update.mock.calls[0][0];
    expect((call.data as any).hack).toBeUndefined();
    expect((call.data as any).name).toBe('改');
  });

  it('3. update 将 Decimal? 空串字段转为 undefined（cleanEmpty）', async () => {
    const tx = txMock();
    mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
    await service.update(1, { name: '改', paymentLimitPct: '' } as any, user);
    const call = tx.crmCustomer.update.mock.calls[0][0];
    expect((call.data as any).paymentLimitPct).toBeUndefined();
  });

  it('4. update 写入 updatedById = user.id', async () => {
    const tx = txMock();
    mock.$transaction.mockImplementation(async (cb: any) => cb(tx));
    await service.update(1, { name: '改' }, user);
    const call = tx.crmCustomer.update.mock.calls[0][0];
    expect((call.data as any).updatedById).toBe(3);
  });

  it('5. remove 调用 crmCustomer.delete（需传 user；2026-09-22 后端加权限闸门）', async () => {
    setMock(mock, 'crmCustomer.delete', { id: 1 });
    // 用 admin 调用（销售角色会在 remove 内抛 ForbiddenException）
    const admin = { id: 1, isAdmin: true, dataScope: 1 } as any;
    await service.remove(1, admin);
    expect(mock.crmCustomer.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('5b. ⚠ 行为记录：销售角色 remove → ForbiddenException（后端 2026-09-22 加权限闸门）', async () => {
    const sales = { id: 2, isAdmin: false, dataScope: 4 } as any;
    setMock(mock, 'crmCustomer.delete', { id: 1 });
    await expect(service.remove(1, sales)).rejects.toThrow('仅管理员可删除客户');
    // 销售员不允许删，所以 prisma.delete 不应被调用
    expect(mock.crmCustomer.delete).not.toHaveBeenCalled();
  });
});
