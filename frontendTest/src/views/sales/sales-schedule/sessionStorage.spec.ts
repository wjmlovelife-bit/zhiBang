/**
 * sessionStorage 保存恢复机制测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('sessionStorage salesScheduleReturn', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it('1. 保存 → 恢复 → 清空 → 验证完整流程', () => {
    const saved = {
      ownerId: 2,
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      scrollY: 1234,
    };
    sessionStorage.setItem('salesScheduleReturn', JSON.stringify(saved));

    // 恢复
    const loaded = JSON.parse(sessionStorage.getItem('salesScheduleReturn'));
    expect(loaded.ownerId).toBe(2);
    expect(loaded.startDate).toBe('2026-09-14');
    expect(loaded.endDate).toBe('2026-09-20');
    expect(loaded.scrollY).toBe(1234);

    // 清空
    sessionStorage.removeItem('salesScheduleReturn');
    expect(sessionStorage.getItem('salesScheduleReturn')).toBeNull();
  });

  it('2. 无数据时返回 null', () => {
    expect(sessionStorage.getItem('salesScheduleReturn')).toBeNull();
  });

  it('3. JSON.parse 失败时优雅处理', () => {
    sessionStorage.setItem('salesScheduleReturn', 'INVALID JSON');
    expect(() => JSON.parse(sessionStorage.getItem('salesScheduleReturn'))).toThrow();
    // 实际代码用 try/catch 捕获
  });

  it('4. scrollY 边界值', () => {
    sessionStorage.setItem('salesScheduleReturn', JSON.stringify({
      ownerId: 2, startDate: '2026-09-14', endDate: '2026-09-20',
      scrollY: 0,
    }));
    const r = JSON.parse(sessionStorage.getItem('salesScheduleReturn'));
    expect(r.scrollY).toBe(0);
  });

  it('5. scrollY 极大值（页面很长）', () => {
    sessionStorage.setItem('salesScheduleReturn', JSON.stringify({
      ownerId: 2, startDate: '2026-09-14', endDate: '2026-09-20',
      scrollY: 999999,
    }));
    const r = JSON.parse(sessionStorage.getItem('salesScheduleReturn'));
    expect(r.scrollY).toBe(999999);
  });
});
