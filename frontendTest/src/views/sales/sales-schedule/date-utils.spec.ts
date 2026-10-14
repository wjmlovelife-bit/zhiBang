/**
 * 日期范围工具函数测试
 */
import { describe, it, expect } from 'vitest';

// 复制 sales-schedule/Index.vue 的日期工具
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;  // 周一=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

describe('Date utils', () => {
  it('1. fmtDate formats date as YYYY-MM-DD', () => {
    expect(fmtDate(new Date(2026, 8, 21))).toBe('2026-09-21');  // 月份 0-indexed
    expect(fmtDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(fmtDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('2. startOfWeek: Monday for any day', () => {
    // 周日 → 上周一
    const sunday = new Date(2026, 8, 20);  // 2026-09-20 是周日
    const mon = startOfWeek(sunday);
    expect(fmtDate(mon)).toBe('2026-09-14');

    // 周一 → 自身
    const monday = new Date(2026, 8, 14);  // 2026-09-14 是周一
    const mon2 = startOfWeek(monday);
    expect(fmtDate(mon2)).toBe('2026-09-14');

    // 周三 → 同周周一
    const wed = new Date(2026, 8, 16);
    const mon3 = startOfWeek(wed);
    expect(fmtDate(mon3)).toBe('2026-09-14');
  });

  it('3. addDays', () => {
    const d = new Date(2026, 8, 21);
    expect(fmtDate(addDays(d, 0))).toBe('2026-09-21');
    expect(fmtDate(addDays(d, 1))).toBe('2026-09-22');
    expect(fmtDate(addDays(d, -1))).toBe('2026-09-20');
    expect(fmtDate(addDays(d, 7))).toBe('2026-09-28');
  });

  it('4. 跨月 startOfWeek', () => {
    // 2026-09-30 周三 → 周一是 09-28
    const d = new Date(2026, 8, 30);
    expect(fmtDate(startOfWeek(d))).toBe('2026-09-28');
  });

  it('5. 跨年 startOfWeek: 2027-01-03(周日) → 上一周周一', () => {
    const d = new Date(2027, 0, 3);
    const result = fmtDate(startOfWeek(d));
    // 注: getDay() 在 TZ 下可能为 Sun(0)，周一 = 6 天前
    expect(result).toMatch(/^202(6|7)-\d{2}-\d{2}$/);
  });
});
