/**
 * composables/useColumnConfig.ts 真实测试
 *
 * 来源：`D:\github\xiangmutest\opencode\zhibang\frontend\src\composables\useColumnConfig.ts`
 * 覆盖：
 *  - applyConfig：按 cfg 顺序排 + 过滤隐藏
 *  - mergeWithDefaults：新加列/锁定列/锁定位置/顺序合并
 *  - useColumnConfig 集成：open/close/save/reset/saveConfig
 *  - localStorage 行为
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyConfig, mergeWithDefaults, useColumnConfig } from '@/composables/useColumnConfig';
import type { ColumnDef, ColumnConfig } from '@/composables/useColumnConfig';

const defaults: ColumnDef[] = [
  { key: 'name', label: '姓名', defaultVisible: true },
  { key: 'phone', label: '电话', defaultVisible: true },
  { key: 'email', label: '邮箱', defaultVisible: false },
  { key: 'actions', label: '操作', defaultVisible: true, lockPosition: true },
];

describe('useColumnConfig - applyConfig', () => {
  it('1. cfg 全 visible → 返回所有列', () => {
    const cfg: ColumnConfig[] = defaults.map((d, i) => ({ key: d.key, visible: true, order: i }));
    const result = applyConfig(defaults, cfg);
    expect(result).toHaveLength(4);
  });

  it('2. cfg 中 email.visible=false → email 被过滤', () => {
    const cfg: ColumnConfig[] = defaults.map((d, i) => ({
      key: d.key, visible: d.key !== 'email', order: i,
    }));
    const result = applyConfig(defaults, cfg);
    expect(result.find((c) => c.key === 'email')).toBeUndefined();
  });

  it('3. cfg order=2 → cfg 列按 order 升序排', () => {
    const cfg: ColumnConfig[] = [
      { key: 'name', visible: true, order: 3 },
      { key: 'phone', visible: true, order: 1 },
      { key: 'email', visible: true, order: 2 },
      { key: 'actions', visible: true, order: 0 },
    ];
    const result = applyConfig(defaults, cfg);
    expect(result.map((c) => c.key)).toEqual(['actions', 'phone', 'email', 'name']);
  });

  it('4. cfg 缺失某列 → 该列按 defaultVisible 决定（true 入/false 不入）', () => {
    const cfg: ColumnConfig[] = [
      { key: 'name', visible: true, order: 0 },
      // phone 缺失（defaultVisible=true → 入）
      // email 缺失（defaultVisible=false → 不入）
      // actions 缺失（defaultVisible=true → 入）
    ];
    const result = applyConfig(defaults, cfg);
    expect(result.map((c) => c.key)).toEqual(['name', 'phone', 'actions']);
  });

  it('5. 不修改 defaults（原数组）', () => {
    const cfg: ColumnConfig[] = defaults.map((d, i) => ({ key: d.key, visible: true, order: i }));
    applyConfig(defaults, cfg);
    expect(defaults).toHaveLength(4);
  });
});

describe('useColumnConfig - mergeWithDefaults', () => {
  it('6. 空 saved → 按 defaults 顺序生成', () => {
    const result = mergeWithDefaults(defaults, null);
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.key)).toEqual(['name', 'phone', 'email', 'actions']);
    // 默认 visible：name/phone/true, email/false, actions/true
    expect(result.find((c) => c.key === 'email')!.visible).toBe(false);
  });

  it('7. 新加列（defaults 有，saved 没有）→ 按 defaultVisible', () => {
    const result = mergeWithDefaults(defaults, [
      { key: 'name', visible: true, order: 0 },
    ]);
    // phone/email/actions 应按 defaultVisible
    const phone = result.find((c) => c.key === 'phone')!;
    expect(phone.visible).toBe(true); // defaultVisible=true
  });

  it('8. 删除列（saved 有，defaults 没有）→ 忽略', () => {
    const result = mergeWithDefaults(defaults, [
      { key: 'name', visible: true, order: 0 },
      { key: 'deleted', visible: true, order: 1 }, // 不在 defaults
    ]);
    expect(result.find((c) => c.key === 'deleted')).toBeUndefined();
  });

  it('9. lockVisible 列 → 永远 visible=true', () => {
    const lockedDefaults = [
      ...defaults,
      { key: 'locked', label: '锁', defaultVisible: false, lockVisible: true } as ColumnDef,
    ];
    const result = mergeWithDefaults(lockedDefaults, [
      { key: 'locked', visible: false, order: 0 }, // 显式 false 也无效
    ]);
    expect(result.find((c) => c.key === 'locked')!.visible).toBe(true);
  });

  it('10. lockPosition 列 → 保持 defaults 中的位置', () => {
    const result = mergeWithDefaults(defaults, [
      { key: 'actions', visible: true, order: 0 }, // saved order=0 但 defaults 中 actions 索引=3
    ]);
    // actions 应仍在最后
    expect(result[result.length - 1].key).toBe('actions');
  });

  it('11. 普通列按 user.order 排', () => {
    const result = mergeWithDefaults(defaults, [
      { key: 'name', visible: true, order: 2 },
      { key: 'phone', visible: true, order: 1 },
      { key: 'email', visible: true, order: 3 },
      { key: 'actions', visible: true, order: 0 }, // 被 lockPosition 忽略
    ]);
    // 非 locked 部分按 order 升序：phone(1), name(2), email(3)
    // locked (actions) 保持在 defaults 中位置（最后）
    const nonLocked = result.filter((c) => c.key !== 'actions');
    expect(nonLocked.map((c) => c.key)).toEqual(['phone', 'name', 'email']);
    expect(result[result.length - 1].key).toBe('actions');
  });
});

describe('useColumnConfig - useColumnConfig (集成)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('12. 初始无 saved config → 用 defaults', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    // config 应包含 4 列
    expect(cfg.config.value.length).toBe(4);
  });

  it('13. open(): visible=true + draft 复制 config', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    cfg.open();
    expect(cfg.visible.value).toBe(true);
    expect(cfg.draft.value.length).toBe(4);
  });

  it('14. close(): visible=false', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    cfg.open();
    cfg.close();
    expect(cfg.visible.value).toBe(false);
  });

  it('15. save(): draft 写 localStorage + 关闭', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    cfg.open();
    cfg.draft.value = cfg.draft.value.map((c) =>
      c.key === 'email' ? { ...c, visible: true } : c,
    );
    cfg.save();
    expect(cfg.visible.value).toBe(false);
    // localStorage 应有 'tableConfig:test-page:user:anon'（当前 user.id 缺 → 'anon'）
    const raw = localStorage.getItem('tableConfig:test-page:user:anon');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.version).toBe(1);
    expect(saved.columns.find((c: any) => c.key === 'email')!.visible).toBe(true);
  });

  it('16. save 后 config 自动重算（响应式）', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    cfg.open();
    // 初始 email visible=false
    expect(cfg.config.value.find((c) => c.key === 'email')!.visible).toBe(false);
    // 改 draft 并 save
    cfg.draft.value = cfg.draft.value.map((c) =>
      c.key === 'email' ? { ...c, visible: true } : c,
    );
    cfg.save();
    // config 应重算
    expect(cfg.config.value.find((c) => c.key === 'email')!.visible).toBe(true);
  });

  it('17. reset(): 恢复默认 + 清 savedConfig', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    cfg.open();
    cfg.draft.value = cfg.draft.value.map((c) => ({ ...c, visible: c.key === 'name' }));
    cfg.save();
    expect(cfg.config.value.find((c) => c.key === 'phone')!.visible).toBe(false); // save 改后
    cfg.reset();
    // 恢复默认
    expect(cfg.config.value.find((c) => c.key === 'phone')!.visible).toBe(true);
    expect(cfg.visible.value).toBe(false);
  });

  it('18. saveConfig(): 直接更新（不经过弹窗草稿）', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    const newCfg: ColumnConfig[] = [
      { key: 'name', visible: true, order: 0 },
    ];
    cfg.saveConfig(newCfg);
    // 持久化
    const raw = localStorage.getItem('tableConfig:test-page:user:anon');
    expect(raw).not.toBeNull();
  });

  it('19. localStorage JSON.parse 失败 → loadSaved 返回 null', () => {
    localStorage.setItem('tableConfig:test-page:user:anon', 'INVALID JSON');
    const cfg = useColumnConfig('test-page', () => defaults);
    // 不报错，用默认
    expect(cfg.config.value.length).toBe(4);
  });

  it('20. localStorage version 不匹配 → loadSaved 返回 null', () => {
    localStorage.setItem('tableConfig:test-page:user:anon', JSON.stringify({
      version: 99, columns: [{ key: 'name', visible: true, order: 0 }],
    }));
    const cfg = useColumnConfig('test-page', () => defaults);
    expect(cfg.config.value.length).toBe(4); // 默认
  });

  it('21. applyTo 应用 config 到列定义', () => {
    const cfg = useColumnConfig('test-page', () => defaults);
    const result = cfg.applyTo(defaults);
    expect(result.length).toBeGreaterThan(0);
  });
});