<template>
  <div>
    <div v-if="editable" style="margin-bottom: 8px">
      <el-button size="small" @click="onAdd">+ 添加跟进</el-button>
    </div>
    <el-table
      :data="pagedSortedRows"
      border
      stripe
      @sort-change="onHeaderSortChange"
      :default-sort="{ prop: 'followDate', order: 'descending' }"
      style="width: 100%"
    >
      <el-table-column label="跟进人" prop="followerName" width="120">
        <template #default="{ row }">
          <span>{{ row.followerName || '-' }}</span>
        </template>
      </el-table-column>

      <!-- 日期 + 上下午（同一列） -->
      <el-table-column label="日期" prop="followDate" width="230" sortable="custom">
        <template #default="{ row }">
          <div v-if="editable" style="display: flex; gap: 4px; align-items: center">
            <el-date-picker
              v-model="row.followDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="flex: 1"
              @change="onFieldChange(row)"
            />
            <el-select
              v-model="row.period"
              placeholder="上下午"
              clearable
              style="width: 90px"
              @change="onFieldChange(row)"
            >
              <el-option label="上午" value="am" />
              <el-option label="下午" value="pm" />
            </el-select>
          </div>
          <div v-else>
            <span>{{ row.followDate }}</span>
            <span v-if="row.period === 'am'" style="margin-left: 6px">上午</span>
            <span v-else-if="row.period === 'pm'" style="margin-left: 6px">下午</span>
          </div>
        </template>
      </el-table-column>

      <!-- 日程（纯文字，与跟进情况同款） -->
      <el-table-column label="日程" prop="schedule" width="180">
        <template #default="{ row }">
          <el-input
            v-if="editable"
            v-model="row.schedule"
            type="textarea"
            :rows="1"
            placeholder="日程"
            @input="onFieldChange(row)"
          />
          <div v-else style="white-space: pre-wrap">{{ row.schedule || '—' }}</div>
        </template>
      </el-table-column>

      <!-- 客户联系人 -->
      <el-table-column label="客户联系人" prop="contactNamesStr" min-width="220">
        <template #default="{ row }">
          <!-- 编辑态：el-select 多选 + 可搜索 -->
          <el-select
            v-if="editable"
            v-model="row.contactNames"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="2"
            clearable
            placeholder="请选择联系人"
            style="width: 100%"
            @change="onFieldChange(row)"
          >
            <el-option
              v-for="o in contactOptions"
              :key="o.value + '_' + (o.contactId ?? '')"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
          <!-- 查看态：每个姓名一个 el-tag -->
          <span v-else>
            <el-tag
              v-for="(n, i) in row.contactNames"
              :key="i"
              size="small"
              style="margin-right: 4px; margin-bottom: 2px"
            >{{ n }}</el-tag>
            <span v-if="!row.contactNames?.length">—</span>
          </span>
        </template>
      </el-table-column>

      <!-- 跟进情况（原"内容"列） -->
      <el-table-column label="跟进情况" prop="content">
        <template #default="{ row }">
          <el-input
            v-if="editable"
            v-model="row.content"
            type="textarea"
            :rows="1"
            placeholder="跟进情况"
            @input="onFieldChange(row)"
          />
          <div v-else style="white-space: pre-wrap">{{ row.content }}</div>
        </template>
      </el-table-column>

      <el-table-column v-if="editable" label="操作" width="80" :key="opKey">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="onDeleteRow(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div style="margin-top: 8px; display: flex; justify-content: flex-end">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="sortedRows.length"
        layout="total, prev, pager, next, jumper"
        background
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';

export interface ContactOption {
  label: string;
  value: string; // contactName
  contactId?: number;
  customerId?: number;
  customerName?: string;
}

export type FollowPeriod = 'am' | 'pm' | null;

export interface FollowRow {
  _localId: number;
  _isNew: boolean;
  _modified?: boolean;
  _deleted?: boolean;
  id?: number;
  followerId?: number;
  followerName?: string;
  followDate: string;
  /** 上午/下午：'am' / 'pm' / null（无默认） */
  period: FollowPeriod;
  /** 日程（纯文字） */
  schedule: string;
  /** 联系人姓名数组（多选）。后端存储为 ; 拼接的字符串。 */
  contactNames: string[];
  /** 跟进情况（原 content） */
  content: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: FollowRow[];
    editable?: boolean;
    pageSize?: number;
    defaultFollowerName?: string;
    /** 编辑态「客户联系人」下拉的选项池 */
    contactOptions?: ContactOption[];
  }>(),
  {
    editable: false,
    pageSize: 10,
    defaultFollowerName: '',
    contactOptions: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [rows: FollowRow[]];
}>();

const opKey = ref(0);
const currentPage = ref(1);
const sortKey = ref<'followDate' | 'followerName' | 'contactNamesStr' | 'content' | 'schedule' | null>('followDate');
const sortOrder = ref<'asc' | 'desc'>('desc');

let localIdSeq = 0;

watch(
  () => props.modelValue,
  (rows) => {
    let max = localIdSeq;
    for (const r of rows) if (r._localId > max) max = r._localId;
    localIdSeq = max;
  },
  { immediate: true, deep: true },
);

function nextLocalId() {
  return ++localIdSeq;
}

// 把数据库字符串 "张三;李四" 拆成 ["张三","李四"]；已为数组则保留
function parseContactName(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(';').map((s) => s.trim()).filter(Boolean);
  return [];
}

// period 字符串 → 排序权重（am=0 / pm=1 / null=2）
function periodRank(p: any): number {
  if (p === 'am') return 0;
  if (p === 'pm') return 1;
  return 2;
}

const sortedRows = computed(() => {
  const rows = props.modelValue.filter((r) => !r._deleted);
  if (!sortKey.value) return rows;
  const k = sortKey.value;
  const order = sortOrder.value === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: any;
    let bv: any;
    if (k === 'contactNamesStr') {
      av = (a.contactNames || []).join('、');
      bv = (b.contactNames || []).join('、');
    } else {
      av = (a as any)[k] ?? '';
      bv = (b as any)[k] ?? '';
    }
    if (k === 'followDate') {
      // 二级排序：同日内 am 早于 pm 早于 null
      const at = av ? new Date(av).getTime() : 0;
      const bt = bv ? new Date(bv).getTime() : 0;
      if (at === bt) {
        return order * (periodRank(a.period) - periodRank(b.period));
      }
      return order * (at - bt);
    }
    return order * String(av).localeCompare(String(bv));
  });
});

const pagedSortedRows = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize;
  return sortedRows.value.slice(start, start + props.pageSize);
});

function emitUpdate(rows: FollowRow[]) {
  // 确保新行也兼容字段
  for (const r of rows) {
    if (!Array.isArray(r.contactNames)) r.contactNames = parseContactName(r.contactNames);
    if (r.period === undefined) r.period = null;
    if (r.schedule === undefined || r.schedule === null) r.schedule = '';
  }
  emit('update:modelValue', [...rows]);
  opKey.value++;
}

function onAdd() {
  const newRow: FollowRow = {
    _localId: nextLocalId(),
    _isNew: true,
    followDate: new Date().toISOString().slice(0, 10),
    followerName: props.defaultFollowerName,
    followerId: undefined,
    period: null, // ← 无默认
    schedule: '', // ← 空
    contactNames: [],
    content: '',
  };
  const rows = [...props.modelValue, newRow];
  emitUpdate(rows);
  nextTick(() => {
    const total = sortedRows.value.length;
    currentPage.value = Math.max(1, Math.ceil(total / props.pageSize));
  });
}

async function onDeleteRow(row: FollowRow) {
  try {
    await ElMessageBox.confirm(
      row._isNew ? '确定删除这条未保存的跟进？' : '确定删除这条跟进？保存后才会真正删除。',
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  if (row._isNew) {
    emitUpdate(props.modelValue.filter((r) => r._localId !== row._localId));
  } else {
    emitUpdate(
      props.modelValue.map((r) => (r._localId === row._localId ? { ...r, _deleted: true } : r)),
    );
  }
}

function onFieldChange(row: FollowRow) {
  if (!row._isNew) row._modified = true;
  emitUpdate([...props.modelValue]);
}

function onHeaderSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!order) {
    sortKey.value = 'followDate';
    sortOrder.value = 'desc';
    return;
  }
  sortKey.value = prop as any;
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc';
}
</script>