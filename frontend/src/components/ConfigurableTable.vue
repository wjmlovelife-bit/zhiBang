<template>
  <div class="configurable-table">
    <!-- 顶部工具条：字段设置按钮 -->
    <div v-if="showToolbar" class="ct-toolbar">
      <el-button size="small" @click="open">
        <el-icon style="margin-right: 4px"><Setting /></el-icon>
        字段设置
      </el-button>
      <span class="ct-hint">拖动表头或字段设置中的行可调整顺序</span>
    </div>

    <!-- 表格本体 -->
    <!-- 问题19 R2：表头拖动后 th 和 td 不一致。
         Element Plus el-table 内部 columnConfigs 按 mount 顺序注册，无 reorder 监听。
         解法：拖动完成后用 :key 让整个 el-table 重新挂载，columnConfigs 按新顺序注册。
         用 :key="col.key"（稳定）保持 column instance 在 visibleColumns 重排时不被销毁重建，
         这样 el-table 整体重挂载时性能更好，且 selection 等内部状态保留。 -->
    <el-table
      ref="tableRef"
      :key="tableRefreshKey"
      :data="data"
      :border="border"
      :default-sort="defaultSort"
      v-bind="$attrs"
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
    >
      <template v-for="col in visibleColumns" :key="col.key">
        <!-- 选择框列：lockPosition=true（不可拖动），加 ct-no-drag class 让 Sortable filter 拦截 -->
        <el-table-column
          v-if="col.type === 'selection'"
          type="selection"
          :width="col.width || 46"
          :fixed="col.fixed"
          class-name="ct-no-drag"
          label-class-name="ct-no-drag"
        />
        <!-- 序号列 -->
        <el-table-column
          v-else-if="col.type === 'index'"
          type="index"
          :label="col.label"
          :width="col.width || 60"
          :fixed="col.fixed"
        />
        <!-- 操作列：lockPosition=true，加 ct-no-drag class -->
        <el-table-column
          v-else-if="col.type === 'actions'"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :fixed="col.fixed || 'right'"
          class-name="ct-no-drag"
          label-class-name="ct-no-drag"
        >
          <template #default="scope">
            <slot :name="col.slotName || 'actionsCell'" :row="scope.row" :$index="scope.$index" />
          </template>
        </el-table-column>
        <!-- 普通列（slotName 渲染） -->
        <el-table-column
          v-else-if="col.slotName"
          :label="col.label"
          :prop="col.prop"
          :width="col.width"
          :min-width="col.minWidth"
          :fixed="col.fixed"
          :sortable="colSortable(col)"
        >
          <template #default="scope">
            <slot :name="col.slotName" :row="scope.row" :$index="scope.$index" />
          </template>
        </el-table-column>
        <!-- 普通列（直接 prop） -->
        <el-table-column
          v-else
          :label="col.label"
          :prop="col.prop"
          :width="col.width"
          :min-width="col.minWidth"
          :fixed="col.fixed"
          :sortable="colSortable(col)"
        />
      </template>
      <!-- 父组件可注入额外列（用于条件渲染或特殊列，如 worklog 的人员列） -->
      <slot name="extra-columns" />
    </el-table>

    <!-- 字段设置弹窗 -->
    <el-dialog
      v-model="cfg.visible.value"
      title="字段设置"
      width="480px"
      append-to-body
      @closed="onDialogClosed"
    >
      <div class="ct-dialog-tip">
        拖动行调整顺序，勾选控制显示列。锁定的行不可拖动。
      </div>
      <ul ref="listRef" class="ct-list">
        <li
          v-for="item in cfg.draft.value"
          :key="item.key"
          :data-key="item.key"
          class="ct-item"
          :class="{ 'ct-locked': isLocked(item.key) }"
        >
          <el-icon class="ct-handle" v-if="!isLocked(item.key)">
            <Rank />
          </el-icon>
          <el-tooltip v-else content="此列已锁定，无法拖动或隐藏" placement="top">
            <el-icon class="ct-locked-icon"><Lock /></el-icon>
          </el-tooltip>
          <el-checkbox
            :model-value="item.visible"
            :disabled="isLockedVisible(item.key)"
            @change="onToggle(item.key, $event)"
          >
            {{ getLabel(item.key) }}
          </el-checkbox>
          <el-tag v-if="colDef(item.key)?.fixed === 'right'" size="small" type="info" effect="plain">
            固定右侧
          </el-tag>
          <el-tag v-else-if="colDef(item.key)?.fixed === 'left'" size="small" type="info" effect="plain">
            固定左侧
          </el-tag>
        </li>
      </ul>
      <template #footer>
        <el-button @click="cfg.reset()">恢复默认</el-button>
        <el-button @click="cfg.close()">取消</el-button>
        <!-- 问题19 R2：保存时也强制 el-table 整体重挂载，让 columnConfigs 按新顺序注册 -->
        <el-button type="primary" @click="onDialogSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { Setting, Rank, Lock } from '@element-plus/icons-vue';
import Sortable from 'sortablejs';
import { useColumnConfig, applyConfig, type ColumnDef, type ColumnConfig } from '@/composables/useColumnConfig';

const props = withDefaults(defineProps<{
  pageKey: string;
  columns: ColumnDef[];
  data: any[];
  border?: boolean;
  showToolbar?: boolean;
  /** 表格里拖动表头的开关，默认 true */
  draggableHeader?: boolean;
  /** 初始/重挂载时的默认排序（prop + Element Plus order 值） */
  defaultSort?: { prop: string; order: 'ascending' | 'descending' };
}>(), {
  border: true,
  showToolbar: true,
  draggableHeader: true,
});

const emit = defineEmits<{
  (e: 'selection-change', rows: any[]): void;
  (e: 'config-change', cols: ColumnDef[]): void;
  (e: 'sort-change', payload: { prop: string; order: 'ascending' | 'descending' | null }): void;
}>();

const tableRef = ref<any>(null);
const listRef = ref<HTMLElement | null>(null);
// 问题19 R2：表头拖动后强制 el-table 整体重挂载，让内部 columnConfigs 按新顺序注册
const tableRefreshKey = ref(0);
let sortableList: Sortable | null = null;
let sortableHeader: Sortable | null = null;

// composable
const cfg = useColumnConfig(props.pageKey, () => props.columns);

function colDef(key: string): ColumnDef | undefined {
  return props.columns.find((c) => c.key === key);
}

function isLocked(key: string): boolean {
  const d = colDef(key);
  return !!(d?.lockPosition);
}

function isLockedVisible(key: string): boolean {
  const d = colDef(key);
  return !!(d?.lockVisible);
}

// 列的排序开关：选择列/操作列永远不可排序；声明了 sortable 的列走后端 custom 排序
function colSortable(col: ColumnDef): boolean | 'custom' {
  if (col.type === 'selection' || col.type === 'actions') return false;
  return col.sortable ? 'custom' : false;
}

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  emit('sort-change', { prop, order });
}

function getLabel(key: string): string {
  return colDef(key)?.label || key;
}

// 实际渲染列（应用用户配置）
const visibleColumns = computed<ColumnDef[]>(() =>
  applyConfig(props.columns, cfg.config.value)
);

watch(visibleColumns, (cols) => emit('config-change', cols), { immediate: false });

function open() {
  cfg.open();
  nextTick(() => initListSortable());
}

function onToggle(key: string, val: any) {
  const found = cfg.draft.value.find((c) => c.key === key);
  if (found) found.visible = !!val;
}

function onSelectionChange(rows: any[]) {
  emit('selection-change', rows);
}

function onDialogClosed() {
  if (sortableList) {
    sortableList.destroy();
    sortableList = null;
  }
}

// 问题19 R2：弹窗"保存"—— cfg.save 改 cfg.config 后，强制 el-table 重挂载
// 让内部 columnConfigs 按新顺序重新注册（el-table 无 reorder 监听，必须重挂载）
function onDialogSave() {
  cfg.save();
  tableRefreshKey.value++;
}

function initListSortable() {
  if (!listRef.value) return;
  if (sortableList) {
    sortableList.destroy();
    sortableList = null;
  }
  sortableList = Sortable.create(listRef.value, {
    animation: 150,
    filter: '.ct-locked',
    preventOnFilter: false,
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex === newIndex) return;
      // 跳过被锁定的行（理论上 filter 已拦截，但仍做一次保护）
      const moved = cfg.draft.value[oldIndex];
      const movedDef = colDef(moved.key);
      if (movedDef?.lockPosition) return;
      const arr = cfg.draft.value.slice();
      arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      // 重新计算 order
      arr.forEach((c, i) => (c.order = i));
      cfg.draft.value = arr;
    },
  });
}

function initHeaderSortable() {
  // 表格表头拖动：找内部 thead tr
  if (!props.draggableHeader) return;
  nextTick(() => {
    const el = tableRef.value?.$el?.querySelector?.('thead tr');
    if (!el) return;
    if (sortableHeader) {
      sortableHeader.destroy();
      sortableHeader = null;
    }
    sortableHeader = Sortable.create(el, {
      animation: 150,
      // 问题19 R2：阻止拖动 lockPosition 列（selection/actions 等）—— DOM 级别 filter
      // 弹窗拖动用 sortableList 也有类似 filter: '.ct-locked'，表头这边同样需要
      filter: '.ct-no-drag',
      // 兜底：移动过程中再次检查（filter 在按住时拦截，但保险起见在 onMove 也拦一次）
      onMove: (evt) => {
        const draggedKey = (evt.dragged as HTMLElement)?.dataset?.key;
        const relatedKey = (evt.related as HTMLElement)?.dataset?.key;
        if (draggedKey && colDef(draggedKey)?.lockPosition) return false;
        if (relatedKey && colDef(relatedKey)?.lockPosition) return false;
        return true;
      },
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        // 把 cfg.config（持久化的）顺序也更新
        const arr = cfg.config.value.slice();
        const moved = arr[oldIndex];
        // 不能移动被 lockPosition 的（兜底——如果 filter 漏了）
        const movedDef = colDef(moved.key);
        if (movedDef?.lockPosition) {
          cfg.config.value = cfg.config.value.slice();
          return;
        }
        arr.splice(oldIndex, 1);
        arr.splice(newIndex, 0, moved);
        arr.forEach((c, i) => (c.order = i));
        // 走 useColumnConfig 的 saveConfig：同步写 localStorage + 更新 savedConfig 触发响应
        cfg.saveConfig(arr);
        // 问题19 R2：强制 el-table 整体重挂载，让内部 columnConfigs 按新顺序重新注册
        // （不能靠 column instance 重排，因为 el-table 无 reorder 监听）
        tableRefreshKey.value++;
      },
    });
  });
}

defineExpose({
  /** 当前可见列（响应式） */
  visibleColumns,
  /** 打开设置弹窗 */
  open,
  /** 拿当前可见列的导出信息（label + getValue） */
  getExportColumns(): Array<{ key: string; label: string; getValue: (row: any) => any }> {
    return visibleColumns.value
      .filter((c) => c.type !== 'selection' && c.type !== 'actions' && c.type !== 'index')
      .map((c) => ({
        key: c.key,
        label: c.label,
        // 复杂列交给父组件通过 slotValueGetters 注入
        getValue: (row: any) => row[c.prop || c.key],
      }));
  },
});

onMounted(() => {
  // 表头拖动需要表格渲染完成后
  setTimeout(initHeaderSortable, 200);
});

// 问题19 R3：tableRefreshKey 变化时（拖动后 el-table 整体重挂载），
// 旧 thead 被销毁，新 thead 是新节点——必须重新初始化 sortableHeader，
// 否则新 thead 上没有 sortable 监听，下次拖动不响应。
watch(tableRefreshKey, () => {
  setTimeout(initHeaderSortable, 200);
});

onBeforeUnmount(() => {
  if (sortableList) {
    sortableList.destroy();
    sortableList = null;
  }
  if (sortableHeader) {
    sortableHeader.destroy();
    sortableHeader = null;
  }
});
</script>

<style scoped>
.configurable-table {
  position: relative;
}
.ct-toolbar {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.ct-hint {
  color: #909399;
  font-size: 12px;
}
.ct-dialog-tip {
  margin-bottom: 10px;
  color: #909399;
  font-size: 12px;
}
.ct-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  max-height: 460px;
  overflow-y: auto;
}
.ct-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  cursor: default;
}
.ct-item:last-child {
  border-bottom: none;
}
.ct-item.ct-locked {
  background: #fafbfc;
}
.ct-handle {
  color: #909399;
  cursor: grab;
}
.ct-handle:active {
  cursor: grabbing;
}
.ct-locked-icon {
  color: #c0c4cc;
  cursor: not-allowed;
}
.ct-item .el-checkbox {
  flex: 1;
}
</style>