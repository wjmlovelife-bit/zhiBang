/**
 * customer 字段处理工具测试（payload.ts 的核心逻辑）
 */
import { describe, it, expect } from 'vitest';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDates(v: any): any {
  if (Array.isArray(v)) return v.map(normalizeDates);
  if (
    v &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    !(typeof v === 'object' && v.constructor && v.constructor.name === 'Decimal')
  ) {
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = normalizeDates(v[k]);
    return out;
  }
  if (typeof v === 'string' && DATE_RE.test(v)) return v + 'T00:00:00.000Z';
  return v;
}

describe('normalizeDates', () => {
  it('1. YYYY-MM-DD 补 ISO DateTime', () => {
    expect(normalizeDates('2026-09-21')).toBe('2026-09-21T00:00:00.000Z');
  });

  it('2. 非日期字符串原样返回', () => {
    expect(normalizeDates('张三')).toBe('张三');
    expect(normalizeDates('abc')).toBe('abc');
    expect(normalizeDates('2026-9-21')).toBe('2026-9-21');  // 不匹配正则
  });

  it('3. Date 实例保持不变', () => {
    const d = new Date('2026-09-21');
    expect(normalizeDates(d)).toBe(d);
  });

  it('4. 数字/null/undefined 原样返回', () => {
    expect(normalizeDates(123)).toBe(123);
    expect(normalizeDates(null)).toBe(null);
    expect(normalizeDates(undefined)).toBe(undefined);
  });

  it('5. 嵌套对象深度处理', () => {
    const r: any = normalizeDates({
      followDate: '2026-09-21',
      content: 'abc',
      nested: { followDate: '2026-09-22' },
    });
    expect(r.followDate).toBe('2026-09-21T00:00:00.000Z');
    expect(r.content).toBe('abc');
    expect(r.nested.followDate).toBe('2026-09-22T00:00:00.000Z');
  });

  it('6. 数组中的日期也处理', () => {
    const r: any = normalizeDates({
      items: [{ date: '2026-09-21' }, { date: '2026-09-22' }],
    });
    expect(r.items[0].date).toBe('2026-09-21T00:00:00.000Z');
    expect(r.items[1].date).toBe('2026-09-22T00:00:00.000Z');
  });
});

describe('cleanEmpty', () => {
  function cleanEmpty(obj: any, fields: string[]) {
    if (!obj) return obj;
    for (const f of fields) {
      if (obj[f] === '' || obj[f] === null) obj[f] = undefined;
    }
    return obj;
  }

  it('7. 空串转 undefined', () => {
    const o = { paymentLimitPct: '', registeredCapital: null };
    cleanEmpty(o, ['paymentLimitPct', 'registeredCapital']);
    expect(o.paymentLimitPct).toBeUndefined();
    expect(o.registeredCapital).toBeUndefined();
  });

  it('8. 有值不转', () => {
    const o = { paymentLimitPct: 50, registeredCapital: 100 };
    cleanEmpty(o, ['paymentLimitPct', 'registeredCapital']);
    expect(o.paymentLimitPct).toBe(50);
    expect(o.registeredCapital).toBe(100);
  });

  it('9. undefined 不变', () => {
    const o = { paymentLimitPct: undefined };
    cleanEmpty(o, ['paymentLimitPct']);
    expect(o.paymentLimitPct).toBeUndefined();
  });
});

describe('splitContactName', () => {
  function splitContactName(s: string | null | undefined): string[] {
    if (!s) return [];
    return s.split(';').map(x => x.trim()).filter(Boolean);
  }

  it('10. null/空 → []', () => {
    expect(splitContactName(null)).toEqual([]);
    expect(splitContactName('')).toEqual([]);
    expect(splitContactName(undefined)).toEqual([]);
  });

  it('11. 单个 → ["name"]', () => {
    expect(splitContactName('张三')).toEqual(['张三']);
  });

  it('12. 多个用 ; 分隔 → [name1, name2]', () => {
    expect(splitContactName('张三;李四;王五')).toEqual(['张三', '李四', '王五']);
  });

  it('13. 去除空白项', () => {
    expect(splitContactName('张三; ;李四;')).toEqual(['张三', '李四']);
  });
});
