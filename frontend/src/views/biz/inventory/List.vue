<template>
  <div>
    <el-card>
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="商品名称">
          <el-input v-model="q.productName" clearable placeholder="模糊匹配" @keyup.enter="load" style="width: 160px" />
        </el-form-item>
        <el-form-item label="商品型号">
          <el-input v-model="q.productModel" clearable placeholder="模糊匹配" @keyup.enter="load" style="width: 160px" />
        </el-form-item>
        <el-form-item label="厂家">
          <el-input v-model="q.manufacturer" clearable placeholder="模糊匹配" @keyup.enter="load" style="width: 160px" />
        </el-form-item>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>

      <div style="margin-bottom: 12px; display: flex; gap: 8px">
        <el-dropdown @command="onExport">
          <el-button>导出<el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部</el-dropdown-item>
              <el-dropdown-item command="selected" :disabled="!selected.length">导出选中</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" v-perm="'biz:inventory:create'" @click="goCreate">新增库存</el-button>
        <el-button v-perm="'biz:inventory:import'" @click="goImport">导入</el-button>
      </div>

      <ConfigurableTable
        ref="tableRef"
        page-key="inventoryList"
        :columns="columns"
        :data="data.items"
        border
        @selection-change="onSel"
      >
        <template #dateCell="{ row }">{{ fmt(row.date) }}</template>
        <template #remarkCell="{ row }">{{ row.remark || '-' }}</template>
        <template #createdByCell="{ row }">{{ row.createdBy?.name || '-' }}</template>
        <template #actionsCell="{ row }">
          <el-button link type="primary" v-perm="'biz:inventory:view'" @click="goView(row)">查看</el-button>
          <el-button link type="primary" v-perm="'biz:inventory:update'" @click="goEdit(row)">编辑</el-button>
          <el-button link type="danger" v-perm="'biz:inventory:delete'" @click="remove(row)">删除</el-button>
        </template>
      </ConfigurableTable>

      <div class="pager">
        <span>共 {{ data.total }} 条 / {{ totalPages }} 页</span>
        <el-select v-model="q.pageSize" style="width: 100px" @change="onPageSize">
          <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="`${s}条/页`" :value="s" />
        </el-select>
        <el-button :disabled="q.page <= 1" @click="go(q.page - 1)">上一页</el-button>
        <el-button :disabled="q.page >= totalPages" @click="go(q.page + 1)">下一页</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { inventoryApi } from '@/api';
import ConfigurableTable from '@/components/ConfigurableTable.vue';
import type { ColumnDef } from '@/composables/useColumnConfig';

const router = useRouter();

// 问题18：表格字段可定制
const columns: ColumnDef[] = [
  { key: 'selection', label: '', type: 'selection', width: 46, fixed: 'left', lockVisible: true, defaultVisible: true },
  { key: 'seq', label: '序号', prop: 'seq', width: 70, defaultVisible: true },
  { key: 'productName', label: '商品名称', prop: 'productName', minWidth: 180, defaultVisible: true },
  { key: 'productModel', label: '商品型号', prop: 'productModel', minWidth: 160, defaultVisible: true },
  { key: 'manufacturer', label: '厂家', prop: 'manufacturer', minWidth: 140, defaultVisible: true },
  { key: 'date', label: '日期', slotName: 'dateCell', width: 120, defaultVisible: true },
  { key: 'remark', label: '备注', slotName: 'remarkCell', minWidth: 220, defaultVisible: true },
  { key: 'createdBy', label: '创建人', slotName: 'createdByCell', width: 110, defaultVisible: false },
  { key: 'actions', label: '操作', type: 'actions', slotName: 'actionsCell', width: 220, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
];

const tableRef = ref<any>(null);
const q = reactive({ productName: '', productModel: '', manufacturer: '', page: 1, pageSize: 10 });
const data = ref<any>({ total: 0, items: [] });
const selected = ref<any[]>([]);
const totalPages = computed(() => Math.max(1, Math.ceil(data.value.total / q.pageSize)));

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

async function load() {
  const res: any = await inventoryApi.list({ ...q });
  data.value = res?.data ?? res;
}
function reset() {
  Object.assign(q, { productName: '', productModel: '', manufacturer: '', page: 1 });
  load();
}
function onSel(rows: any[]) {
  selected.value = rows;
}
function onPageSize() {
  q.page = 1;
  load();
}
function go(p: number) {
  q.page = p;
  load();
}

// 进入详情/编辑/新建/导入前保存查询条件，详情返回时恢复
function snapshotQuery() {
  sessionStorage.setItem('inventoryQuery', JSON.stringify({
    productName: q.productName,
    productModel: q.productModel,
    manufacturer: q.manufacturer,
    page: q.page,
    pageSize: q.pageSize,
  }));
}
function goView(row: any) {
  snapshotQuery();
  router.push(`/biz/inventory/${row.id}/detail`);
}
function goEdit(row: any) {
  snapshotQuery();
  router.push(`/biz/inventory/${row.id}`);
}
function goCreate() {
  snapshotQuery();
  router.push('/biz/inventory/new');
}
function goImport() {
  snapshotQuery();
  router.push('/biz/inventory/import');
}

async function onExport(cmd: string) {
  // 加载当前筛选条件下全部
  const rows: any = cmd === 'selected' ? selected.value : (await inventoryApi.exportAll());
  const list = Array.isArray(rows) ? rows : (rows?.items || []);
  // 问题18：导出按当前表格显示列（用户配置）走
  const expCols = tableRef.value?.getExportColumns?.() || [];
  const getters: Record<string, (row: any) => any> = {
    seq: (r, i) => i + 1,
    productName: (r) => r.productName,
    productModel: (r) => r.productModel,
    manufacturer: (r) => r.manufacturer,
    date: (r) => fmt(r.date),
    remark: (r) => r.remark || '',
    createdBy: (r) => r.createdBy?.name || '',
  };
  const header = expCols.map((c: any) => c.label);
  const lines = [header.join(',')];
  list.forEach((r: any, i: number) =>
    lines.push(
      expCols
        .map((c: any) => getters[c.key]?.(r, i) ?? '')
        .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  );
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '库存列表.csv';
  a.click();
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除库存「${row.productName} / ${row.productModel}」？`, '提示', { type: 'warning' });
  await inventoryApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}

onMounted(async () => {
  // 返回时从 sessionStorage 恢复查询条件
  const saved = sessionStorage.getItem('inventoryQuery');
  if (saved) {
    try {
      Object.assign(q, JSON.parse(saved));
      sessionStorage.removeItem('inventoryQuery');
    } catch {}
  }
  await load();
});
</script>
