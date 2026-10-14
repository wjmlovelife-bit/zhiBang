// composables/useColumnConfig.ts
// 表格列可见性 + 顺序的本地存储 composable
// 用法：
//   const cfg = useColumnConfig('customerList', () => columnsDef);
//   const visibleColumns = computed(() => cfg.applyTo(columnsDef)); // 列定义 -> 运行时配置
//   cfg.open(); // 打开设置弹窗（弹窗逻辑放在 ConfigurableTable 组件里）
//
// 存储：localStorage，key = `tableConfig:${pageKey}:user:${userId}`
// 每用户独立（决策 #1）
// 前端存储，不走后端（决策 #2）
//
// 关键设计：savedConfig 是 ref（不是直接调 loadSaved()），
// 这样 save() 后修改 savedConfig.value → config computed 自动重算 →
// 表格列 + 弹窗草稿都跟着更新。

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { logger } from '@/utils/logger';

export interface ColumnDef {
  key: string;
  label: string;
  prop?: string;
  width?: number | string;
  minWidth?: number;
  fixed?: 'left' | 'right';
  type?: 'selection' | 'actions' | 'index' | 'normal';
  slotName?: string;
  defaultVisible: boolean;
  /** 锁定可见性（true=不可隐藏，例如 actions/selection） */
  lockVisible?: boolean;
  /** 锁定位置（true=不可拖动，例如 actions/selection） */
  lockPosition?: boolean;
  /** 是否可排序（true=由后端排序，点击表头触发 sort-change） */
  sortable?: boolean;
}

export interface ColumnConfig {
  key: string;
  visible: boolean;
  order: number;
}

interface SavedConfig {
  version: number;
  columns: ColumnConfig[];
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'tableConfig';

function currentUserId(): string | number {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.id ?? 'anon';
    }
  } catch {}
  return 'anon';
}

function storageKey(pageKey: string, userId: string | number): string {
  return `${STORAGE_PREFIX}:${pageKey}:user:${userId}`;
}

/**
 * 把"列定义"和"用户保存的配置"合并，返回最终的运行时配置。
 * 规则：
 *   - 新加列（defaults 中有但 saved 没有）→ 按 defaultVisible 出现在合适位置
 *   - 删除列（saved 中有但 defaults 中没有）→ 忽略
 *   - 锁定列（lockVisible）→ 永远 visible=true
 *   - 锁定位置（lockPosition）→ 始终保持在 defaults 中的位置（如 actions 永远在最后）
 *   - 其他列按用户保存的 order 升序排
 *
 * 关键：finalOrder 的顺序 == 用户的"视觉顺序"，这样消费方 splice 时索引才不会错位。
 */
function mergeWithDefaults(
  defaults: ColumnDef[],
  saved: ColumnConfig[] | null,
): ColumnConfig[] {
  // 1. 构建 saved Map
  const savedMap = new Map<string, ColumnConfig>();
  if (saved) for (const c of saved) savedMap.set(c.key, c);

  // 2. 合并默认 + 已保存：构造 result
  const result: ColumnConfig[] = [];
  defaults.forEach((d, idx) => {
    const s = savedMap.get(d.key);
    const order =
      s?.order !== undefined && !d.lockPosition ? s.order : idx;
    result.push({
      key: d.key,
      visible: d.lockVisible ? true : (s?.visible ?? d.defaultVisible),
      order,
    });
  });

  // 3. 分两堆：locked 保持原 defaults 位置；movable 按 order 排序
  const locked: ColumnConfig[] = [];
  const movable: ColumnConfig[] = [];
  result.forEach((c) => {
    const def = defaults.find((d) => d.key === c.key)!;
    if (def.lockPosition) locked.push(c);
    else movable.push(c);
  });
  movable.sort((a, b) => a.order - b.order);

  // 4. 按 defaults 顺序填：locked 直接 push 到其在 defaults 的位置；
  //    movable 按排好顺序逐个填到非 locked 位置
  // 这样输出顺序 = 用户期望的视觉顺序（locked 保持 defaults 位置，其他按 user order 排）
  const finalOrder: ColumnConfig[] = [];
  let mi = 0;
  defaults.forEach((d) => {
    if (d.lockPosition) {
      const lk = locked.find((x) => x.key === d.key)!;
      finalOrder.push(lk);
    } else {
      finalOrder.push(movable[mi++]);
    }
  });

  return finalOrder;
}

/** 把"列定义 + 配置"转成运行时可见列（按用户配置的顺序，已过滤隐藏） */
export function applyConfig(columns: ColumnDef[], cfg: ColumnConfig[]): ColumnDef[] {
  const orderMap = new Map(cfg.map((c) => [c.key, c.order]));
  return columns
    .filter((c) => {
      const cc = cfg.find((x) => x.key === c.key);
      return cc ? cc.visible : c.defaultVisible;
    })
    .slice()
    .sort((a, b) => (orderMap.get(a.key) ?? 0) - (orderMap.get(b.key) ?? 0));
}

export interface UseColumnConfigReturn {
  /** 已合并好的列配置（响应式） */
  config: ReturnType<typeof computed<ColumnConfig[]>>;
  /** 应用配置到列定义 */
  applyTo: (columns: ColumnDef[]) => ColumnDef[];
  /** 打开设置弹窗 */
  open: () => void;
  /** 关闭设置弹窗 */
  close: () => void;
  /** 弹窗可见性 */
  visible: ReturnType<typeof ref<boolean>>;
  /** 弹窗里临时编辑的配置（保存时才落盘） */
  draft: ReturnType<typeof ref<ColumnConfig[]>>;
  /** 保存草稿到 localStorage */
  save: () => void;
  /** 恢复默认 */
  reset: () => void;
}

// 单独导出 mergeWithDefaults 供测试
export { mergeWithDefaults };

export function useColumnConfig(pageKey: string, columns: () => ColumnDef[]): UseColumnConfigReturn {
  const visible = ref(false);
  const draft = ref<ColumnConfig[]>([]);

  // 当前用户 ID
  const userId = currentUserId();

  // 读取已保存配置
  function loadSaved(): ColumnConfig[] | null {
    try {
      const raw = localStorage.getItem(storageKey(pageKey, userId));
      if (!raw) return null;
      const parsed: SavedConfig = JSON.parse(raw);
      if (parsed.version !== STORAGE_VERSION) return null;
      return parsed.columns;
    } catch {
      return null;
    }
  }

  // 关键修复：把 saved 配置做成响应式 ref（之前直接调 loadSaved() 不在响应链里，save 后 config 不重算）
  const savedConfig = ref<ColumnConfig[] | null>(loadSaved());

  // 计算当前合并后的 config
  const config = computed<ColumnConfig[]>(() => mergeWithDefaults(columns(), savedConfig.value));

  function applyTo(cols: ColumnDef[]): ColumnDef[] {
    return applyConfig(cols, config.value);
  }

  function open() {
    // 拷贝当前 config 到 draft
    draft.value = config.value.map((c) => ({ ...c }));
    visible.value = true;
  }

  function close() {
    visible.value = false;
  }

  function persist(cols: ColumnConfig[]) {
    const data: SavedConfig = { version: STORAGE_VERSION, columns: cols };
    try {
      localStorage.setItem(storageKey(pageKey, userId), JSON.stringify(data));
    } catch (e) {
      logger.warn('[useColumnConfig] persist failed', e);
    }
  }

  function save() {
    persist(draft.value);
    // 关键：更新响应式 savedConfig，触发 config computed 重新计算
    savedConfig.value = draft.value.map((c) => ({ ...c }));
    visible.value = false;
  }

  function reset() {
    // 默认：按 columns 的 defaultVisible + defaults 顺序
    const defs = columns();
    const defaultCfg: ColumnConfig[] = defs.map((d, idx) => ({
      key: d.key,
      visible: d.lockVisible ? true : d.defaultVisible,
      order: idx,
    }));
    draft.value = defaultCfg;
    persist(defaultCfg);
    // 关键：清空 savedConfig，触发 config 重新计算 fallback 到 defaults
    savedConfig.value = null;
    visible.value = false;
  }

  /**
   * 供表头拖动场景使用：直接更新 savedConfig（不经过弹窗草稿）。
   * 父组件可选择只调 saveConfig()，不写 localStorage（如果由父组件自己写）。
   */
  function saveConfig(cols: ColumnConfig[]) {
    persist(cols);
    savedConfig.value = cols.map((c) => ({ ...c }));
  }

  return {
    config,
    applyTo,
    open,
    close,
    visible,
    draft,
    save,
    reset,
    saveConfig,
  };
}