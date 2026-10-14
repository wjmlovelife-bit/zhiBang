// tests/unit/useColumnConfig.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyConfig,
  mergeWithDefaults,
  type ColumnDef,
  type ColumnConfig,
} from '../../src/composables/useColumnConfig';

describe('applyConfig', () => {
  const cols: ColumnDef[] = [
    { key: 'a', label: 'A', prop: 'a', defaultVisible: true },
    { key: 'b', label: 'B', prop: 'b', defaultVisible: true },
    { key: 'c', label: 'C', prop: 'c', defaultVisible: false },
    { key: 'd', label: 'D', prop: 'd', defaultVisible: true, lockPosition: true },
    { key: 'actions', label: '操作', type: 'actions', defaultVisible: true, lockVisible: true, lockPosition: true },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it('默认情况：defaultVisible=true 出现，false 隐藏，顺序按 defaults', () => {
    const cfg: ColumnConfig[] = [
      { key: 'a', visible: true, order: 0 },
      { key: 'b', visible: true, order: 1 },
      { key: 'c', visible: false, order: 2 },
      { key: 'd', visible: true, order: 3 },
      { key: 'actions', visible: true, order: 4 },
    ];
    const out = applyConfig(cols, cfg);
    expect(out.map((c) => c.key)).toEqual(['a', 'b', 'd', 'actions']);
  });

  it('用户取消勾选 c，应该被过滤掉', () => {
    const cfg: ColumnConfig[] = [
      { key: 'a', visible: true, order: 0 },
      { key: 'b', visible: true, order: 1 },
      { key: 'c', visible: false, order: 2 },
      { key: 'd', visible: true, order: 2.5 },
      { key: 'actions', visible: true, order: 3 },
    ];
    const out = applyConfig(cols, cfg);
    expect(out.find((c) => c.key === 'c')).toBeUndefined();
  });

  it('用户拖动改变顺序：把 b 放到 a 前面', () => {
    const cfg: ColumnConfig[] = [
      { key: 'b', visible: true, order: -1 }, // 提前
      { key: 'a', visible: true, order: 0 },
      { key: 'c', visible: false, order: 2 },
      { key: 'd', visible: true, order: 3 },
      { key: 'actions', visible: true, order: 4 },
    ];
    const out = applyConfig(cols, cfg);
    // b 应该排在最前，但 d（lockPosition）保持原 defaults 顺序的相对位置
    const keys = out.map((c) => c.key);
    expect(keys[0]).toBe('b');
    expect(keys).toContain('d');
    expect(keys).toContain('actions');
  });

  it('新加列（defaults 比 saved 多）→ 自动加入', () => {
    const cfg: ColumnConfig[] = [
      { key: 'a', visible: true, order: 0 },
      { key: 'b', visible: true, order: 1 },
      // c, d, actions 缺失
    ];
    const out = applyConfig(cols, cfg);
    expect(out.map((c) => c.key)).toContain('d');
    expect(out.map((c) => c.key)).toContain('actions');
  });

  it('删除列（saved 比 defaults 多）→ 忽略', () => {
    const cfg: ColumnConfig[] = [
      { key: 'a', visible: true, order: 0 },
      { key: 'b', visible: true, order: 1 },
      { key: 'c', visible: false, order: 2 },
      { key: 'd', visible: true, order: 3 },
      { key: 'actions', visible: true, order: 4 },
      { key: 'deleted', visible: true, order: 5 }, // 不存在
    ];
    const out = applyConfig(cols, cfg);
    expect(out.find((c) => c.key === 'deleted')).toBeUndefined();
  });
});

describe('mergeWithDefaults（修复后：按 user order 排，locked 保持 defaults 位置）', () => {
  const cols: ColumnDef[] = [
    { key: 'selection', label: '', type: 'selection', defaultVisible: true, lockVisible: true }, // 可拖
    { key: 'code', label: '客户编号', defaultVisible: true },
    { key: 'owner', label: '负责销售人', defaultVisible: true },
    { key: 'name', label: '客户名称', defaultVisible: true },
    { key: 'contacts', label: '联系人', defaultVisible: true },
    { key: 'followStage', label: '洽谈进展', defaultVisible: true },
    { key: 'actions', label: '操作', type: 'actions', defaultVisible: true, lockVisible: true, lockPosition: true }, // 锁定
  ];

  it('没 saved：按 defaults 顺序输出', () => {
    const out = mergeWithDefaults(cols, null);
    expect(out.map((c) => c.key)).toEqual(['selection', 'code', 'owner', 'name', 'contacts', 'followStage', 'actions']);
  });

  it('用户把 followStage 拖到 name 前面：followStage.order=2, name.order=3', () => {
    const saved: ColumnConfig[] = [
      { key: 'selection', visible: true, order: 0 },
      { key: 'code', visible: true, order: 0 },
      { key: 'owner', visible: true, order: 1 },
      { key: 'name', visible: true, order: 3 }, // 用户改：排到第 3 位
      { key: 'contacts', visible: true, order: 4 },
      { key: 'followStage', visible: true, order: 2 }, // 用户改：提前
      { key: 'actions', visible: true, order: 6 },
    ];
    const out = mergeWithDefaults(cols, saved);
    expect(out.map((c) => c.key)).toEqual([
      'selection',
      'code',
      'owner',
      'followStage', // ✓ 在 name 前面
      'name',
      'contacts',
      'actions',
    ]);
  });

  it('多次拖动后顺序仍正确（模拟表头连续拖动）', () => {
    // 用户先拖 name 到 followStage 后，再拖 contacts 到 name 前
    const saved: ColumnConfig[] = [
      { key: 'selection', visible: true, order: 0 },
      { key: 'code', visible: true, order: 1 },
      { key: 'owner', visible: true, order: 2 },
      { key: 'contacts', visible: true, order: 3 }, // 提前
      { key: 'followStage', visible: true, order: 4 },
      { key: 'name', visible: true, order: 5 },
      { key: 'actions', visible: true, order: 6 },
    ];
    const out = mergeWithDefaults(cols, saved);
    expect(out.map((c) => c.key)).toEqual([
      'selection',
      'code',
      'owner',
      'contacts', // ✓ 在 followStage 前
      'followStage',
      'name',
      'actions',
    ]);
  });

  it('saved 是 defaults 顺序（未改过），输出应与 defaults 一致', () => {
    const saved: ColumnConfig[] = cols.map((d, idx) => ({ key: d.key, visible: d.defaultVisible, order: idx }));
    const out = mergeWithDefaults(cols, saved);
    expect(out.map((c) => c.key)).toEqual(cols.map((c) => c.key));
  });

  it('actions 永远在最后（lockedPosition）', () => {
    const saved: ColumnConfig[] = [
      { key: 'actions', visible: true, order: 0 }, // 用户想提前到第 1 位
      { key: 'code', visible: true, order: 1 },
      { key: 'name', visible: true, order: 2 },
      { key: 'followStage', visible: true, order: 3 },
    ];
    const out = mergeWithDefaults(cols, saved);
    // actions.lockPosition=true，应该保持在最后（defaults 最后一个位置）
    expect(out[out.length - 1].key).toBe('actions');
  });

  it('cfg.config.value 顺序 == visibleColumns 顺序（修复 splice 错位的关键）', () => {
    const saved: ColumnConfig[] = [
      { key: 'selection', visible: true, order: 0 },
      { key: 'code', visible: true, order: 0 },
      { key: 'owner', visible: true, order: 1 },
      { key: 'name', visible: true, order: 3 },
      { key: 'contacts', visible: true, order: 4 },
      { key: 'followStage', visible: true, order: 2 },
      { key: 'actions', visible: true, order: 6 },
    ];
    const merged = mergeWithDefaults(cols, saved);
    const visible = applyConfig(cols, merged);
    // 关键断言：merged 顺序 == visible 顺序（用户改过后依然）
    expect(merged.map((c) => c.key)).toEqual(visible.map((c) => c.key));
  });
});