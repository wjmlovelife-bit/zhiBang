/**
 * payload 工具单元测试（覆盖 common/utils/payload.ts 全部导出函数）
 *
 * 说明：源码 payload.ts 仅导出 normalizeDates / scrub / sanitize / cleanArrayFields。
 * 文档用例 11-14 涉及的 cleanEmpty / splitContactName 在源码中并不存在（不是导出函数），故不测。
 * 另：源码 normalizeDates 对 Date 实例原样返回（不转 ISO），仅 "YYYY-MM-DD" 字符串补成 ISO；
 * scrub(model, body) 无 keepId 选项，且保留所有 enum 标量字段（含 id/createdAt/updatedAt）。
 * 以下用例均按源码真实行为编写。
 */
import { normalizeDates, scrub, sanitize, cleanArrayFields } from '@app/common/utils/payload';
import { Prisma } from '@prisma/client';

describe('payload utils', () => {
  it('1. sanitize 只保留 enum 字段，丢弃未知字段', () => {
    const out: any = sanitize('CrmCustomer', { id: 1, name: 'A', hack: 'x' });
    expect(out.id).toBe(1);
    expect(out.name).toBe('A');
    expect(out.hack).toBeUndefined();
  });

  it('2. sanitize 未知模型原样返回', () => {
    expect(sanitize('Foo', { a: 1 })).toEqual({ a: 1 });
  });

  it('3. scrub 丢弃未知顶层字段，保留 enum 标量字段', () => {
    const out: any = scrub('CrmCustomer', { id: 1, name: 'A', bogus: 'x' } as any);
    expect(out.id).toBe(1);
    expect(out.name).toBe('A');
    expect(out.bogus).toBeUndefined();
  });

  it('4. scrub 未知模型原样返回', () => {
    expect(scrub('Foo', { a: 1 } as any)).toEqual({ a: 1 });
  });

  it('5a. normalizeDates 将 "YYYY-MM-DD" 字符串补成 ISO', () => {
    expect(normalizeDates({ d: '2026-01-01' }).d).toBe('2026-01-01T00:00:00.000Z');
  });

  it('5b. normalizeDates Date 实例原样返回（不转 ISO）', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    const out = normalizeDates({ d });
    expect(out.d).toBe(d);
    expect(out.d instanceof Date).toBe(true);
  });

  it('6. normalizeDates 跳过 Prisma.Decimal 实例', () => {
    const dec = new Prisma.Decimal('1.5');
    const out = normalizeDates({ v: dec });
    expect(out.v).toBe(dec);
  });

  it('7. normalizeDates 递归嵌套数组', () => {
    const out = normalizeDates({ list: [{ d: '2026-01-01' }] });
    expect(out.list[0].d).toBe('2026-01-01T00:00:00.000Z');
  });

  it('8. cleanArrayFields 保留数组（含空串/null）', () => {
    const out = cleanArrayFields({ tags: [1, '', null, 2] }, ['tags']);
    expect(out.tags).toEqual([1, '', null, 2]);
  });

  it('9. cleanArrayFields 字段不存在不报错', () => {
    expect(cleanArrayFields({}, ['tags'])).toEqual({});
  });

  it('10. cleanArrayFields 标量字段不动', () => {
    expect(cleanArrayFields({ name: 'A' }, ['tags'])).toEqual({ name: 'A' });
  });
});
