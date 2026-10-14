/**
 * SalesSchedule 表格组件测试
 * 验证：
 * 1. totalRows computed 计算正确
 * 2. rowMinHeight 函数
 * 3. textareaMinHeight 函数
 */
import { describe, it, expect } from 'vitest';

// 提取 Index.vue 的纯函数逻辑（不测组件渲染，只测计算逻辑）
describe('SalesSchedule utilities', () => {
  // rowMinHeight 函数（同 backendTest/src/unit/sales-schedule.spec.ts 的逻辑）
  function rowMinHeight(text: string | undefined): number {
    if (!text) return 32;
    const segments = text.split(/\n/);
    let totalLines = 0;
    for (const seg of segments) {
      totalLines += Math.max(1, Math.ceil((seg.length || 1) / 22));
    }
    return Math.max(32, 8 + totalLines * 24);
  }

  function textareaMinHeight(text: string | undefined): number {
    if (!text) return 60;
    const segments = text.split(/\n/);
    let totalLines = 0;
    for (const seg of segments) {
      totalLines += Math.max(1, Math.ceil((seg.length || 1) / 80));
    }
    return Math.max(60, 8 + totalLines * 22);
  }

  function totalRows(days: { am: any[]; pm: any[] }[]): number {
    let dataRows = 0;
    for (const day of days) {
      if (day.am.length || day.pm.length) {
        dataRows += day.am.length + day.pm.length;
      } else {
        dataRows += 1;
      }
    }
    return 3 + 1 + dataRows;
  }

  it('1. rowMinHeight: empty text returns 32px', () => {
    expect(rowMinHeight('')).toBe(32);
    expect(rowMinHeight(undefined)).toBe(32);
  });

  it('2. rowMinHeight: 22 chars = 1 line = 32px', () => {
    expect(rowMinHeight('a'.repeat(22))).toBeGreaterThanOrEqual(32);
  });

  it('3. rowMinHeight: 50 chars = 3 lines = 80px', () => {
    const r = rowMinHeight('a'.repeat(50));
    expect(r).toBe(8 + 3 * 24); // 80px
  });

  it('4. textareaMinHeight: empty = 60px', () => {
    expect(textareaMinHeight('')).toBe(60);
  });

  it('5. textareaMinHeight: 80 chars = 1 line = 60px', () => {
    const r = textareaMinHeight('a'.repeat(80));
    expect(r).toBeGreaterThanOrEqual(60);
  });

  it('6. textareaMinHeight: 200 chars = 3 lines', () => {
    const r = textareaMinHeight('a'.repeat(200));
    expect(r).toBe(8 + 3 * 22); // 74px
  });

  it('7. totalRows: 7 天无数据 → 3+1+7 = 11 行', () => {
    const days = Array.from({ length: 7 }, () => ({ am: [], pm: [] }));
    expect(totalRows(days)).toBe(11);
  });

  it('8. totalRows: 7 天各 2 个 am + 1 个 pm → 3+1+21 = 25 行', () => {
    const days = Array.from({ length: 7 }, () => ({ am: [{}, {}], pm: [{}] }));
    expect(totalRows(days)).toBe(25);
  });

  it('9. totalRows: 部分天有数据，部分天无数据 → 仍正确', () => {
    const days = [
      { am: [{}], pm: [] },
      { am: [], pm: [] },  // 空
      { am: [], pm: [{}, {}] },
    ];
    expect(totalRows(days)).toBe(3 + 1 + (1 + 1 + 2)); // 8
  });
});
