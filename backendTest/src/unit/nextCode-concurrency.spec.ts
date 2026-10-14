/**
 * nextCode TOCTOU 修复并发测试
 *
 * 验证：50 个并发 nextCode 调用必须全部生成不同的 seq 值。
 *
 * 旧实现（findFirst + parseInt + create）下，并发 50 次会拿到同一序号 → P2002。
 * 新实现（PG SEQUENCE nextval）保证原子递增 → 50 个值全不同。
 *
 * 验证 3 个业务：
 *  - CustomerService (KH*)
 *  - WorkLogService (RJ*)
 *  - ProjectService (XM*)
 */
import { CustomerService } from '@app/modules/customer/customer.service';
import { WorkLogService } from '@app/modules/worklog/worklog.service';
import { ProjectService } from '@app/modules/project/project.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('nextCode 并发安全（PG SEQUENCE）', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
  });
  afterEach(() => resetMockPrisma(mock));

  // 模拟 SEQUENCE 行为：每次 nextval 原子递增
  let counter = 0;
  function seqNextVal(): bigint {
    counter += 1;
    return BigInt(counter);
  }

  function bindSeq() {
    (mock as any).$queryRaw = jest.fn().mockImplementation(async () => [{ nextval: seqNextVal() }]);
  }

  it('1. CustomerService: 50 次并发调用 → 全部不同 seq', async () => {
    counter = 0;
    bindSeq();
    const svc = new CustomerService(mock as any);
    const promises = Array.from({ length: 50 }, () => svc.nextCode());
    const codes = await Promise.all(promises);
    // 50 个不同 code
    expect(new Set(codes).size).toBe(50);
    // 序号 1..50
    const seqs = codes.map(c => parseInt(c.slice(-4), 10)).sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[49]).toBe(50);
    // 全部匹配 KH\d{8}\d{4} 格式
    for (const c of codes) expect(c).toMatch(/^KH\d{8}\d{4}$/);
  });

  it('2. WorkLogService: 50 次并发调用 → 全部不同 seq', async () => {
    counter = 0;
    bindSeq();
    const svc = new WorkLogService(mock as any);
    const promises = Array.from({ length: 50 }, () => svc.nextCode());
    const codes = await Promise.all(promises);
    expect(new Set(codes).size).toBe(50);
    const seqs = codes.map(c => parseInt(c.slice(-4), 10)).sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[49]).toBe(50);
    for (const c of codes) expect(c).toMatch(/^RJ\d{8}\d{4}$/);
  });

  it('3. ProjectService: 50 次并发调用 → 全部不同 seq', async () => {
    counter = 0;
    bindSeq();
    const svc = new ProjectService(mock as any);
    const promises = Array.from({ length: 50 }, () => svc.nextCode());
    const codes = await Promise.all(promises);
    expect(new Set(codes).size).toBe(50);
    const seqs = codes.map(c => parseInt(c.slice(-4), 10)).sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[49]).toBe(50);
    for (const c of codes) expect(c).toMatch(/^XM\d{8}\d{4}$/);
  });

  it('4. ⚠ 兜底：$queryRaw 抛错 → 回退 findFirst 旧逻辑', async () => {
    // SEQUENCE 不存在时（迁移未跑），service 应回退到 findFirst 模式
    counter = 0;
    (mock as any).$queryRaw = jest.fn().mockRejectedValue(new Error('relation "public.customer_code_seq" does not exist'));
    (mock.crmCustomer.findFirst as any).mockResolvedValue({ code: 'KH202609230001' });
    const svc = new CustomerService(mock as any);
    const code = await svc.nextCode();
    // parseInt('0001')=1, +1=2 → KH202609230002
    expect(code).toMatch(/^KH\d{8}0002$/);
  });
});