<template>
  <div>
    <el-card>
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="关键词"><el-input v-model="q.keyword" placeholder="标题/客户/编号" clearable @keyup.enter="load" style="width:200px" /></el-form-item>
        <el-form-item label="审批状态">
          <el-select v-model="q.approvalState" clearable @change="load" style="width:130px">
            <el-option label="草稿" value="draft" /><el-option label="已审批" value="approved" />
          </el-select>
        </el-form-item>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <div style="margin-bottom:12px; display:flex; gap:8px">
        <el-dropdown @command="onExport">
          <el-button>导出<el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部</el-dropdown-item>
              <el-dropdown-item command="selected" :disabled="!selected.length">导出选中</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" @click="goCreate">新建合同</el-button>
      </div>
      <ConfigurableTable
        ref="tableRef"
        page-key="contractList"
        :columns="columns"
        :data="data.items"
        border
        @selection-change="onSel"
      >
        <template #signDateCell="{ row }">{{ fmt(row.signDate) }}</template>
        <template #startDateCell="{ row }">{{ fmt(row.startDate) }}</template>
        <template #endDateCell="{ row }">{{ fmt(row.endDate) }}</template>
        <template #statusCell="{ row }">
          <el-tag :type="row.approvalState === 'draft' ? 'info' : 'success'">
            {{ row.approvalState === 'draft' ? '草稿' : '已审批' }}
          </el-tag>
        </template>
        <template #actionsCell="{ row }">
          <el-button link type="info" @click="goView(row)">查看</el-button>
          <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
          <el-button link type="success" @click="openPdf(row)">PDF</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </ConfigurableTable>
      <div class="pager">
        <span>共 {{ data.total }} 条 / {{ totalPages }} 页</span>
        <el-select v-model="q.pageSize" style="width:100px" @change="onPageSize">
          <el-option v-for="s in [10,20,50,100]" :key="s" :label="`${s}条/页`" :value="s" />
        </el-select>
        <el-button :disabled="q.page<=1" @click="go(q.page-1)">上一页</el-button>
        <el-button :disabled="q.page>=totalPages" @click="go(q.page+1)">下一页</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { contractApi } from '@/api';
import { openPdfPreview } from '@/composables/usePdfPreview';
import ConfigurableTable from '@/components/ConfigurableTable.vue';
import type { ColumnDef } from '@/composables/useColumnConfig';

const router = useRouter();
const q = reactive({ keyword:'', approvalState:'', page:1, pageSize:20 });
const data = ref<any>({ total:0, items:[] });
const totalPages = computed(()=>Math.max(1, Math.ceil(data.value.total/q.pageSize)));
const selected = ref<any[]>([]);

// 问题18：表格字段可定制
const columns: ColumnDef[] = [
  { key: 'selection', label: '', type: 'selection', width: 46, fixed: 'left', lockVisible: true, lockPosition: true, defaultVisible: true },
  { key: 'code',         label: '合同编号', prop: 'code',         width: 150, defaultVisible: true },
  { key: 'title',        label: '标题',     prop: 'title',        minWidth: 160, defaultVisible: true },
  { key: 'customerName', label: '客户名称', prop: 'customerName', width: 160, defaultVisible: true },
  { key: 'opportunityCode', label: '关联项目编号', prop: 'opportunityCode', width: 130, defaultVisible: false },
  { key: 'signDate',     label: '签约日期', slotName: 'signDateCell', width: 120, defaultVisible: true },
  { key: 'startDate',    label: '开始日期', slotName: 'startDateCell', width: 110, defaultVisible: false },
  { key: 'endDate',      label: '结束日期', slotName: 'endDateCell', width: 110, defaultVisible: false },
  { key: 'currencyCode', label: '币种',     prop: 'currencyCode', width: 80, defaultVisible: false },
  { key: 'amountTotal',  label: '总金额',   prop: 'amountTotal',  width: 120, defaultVisible: true },
  { key: 'ownerName',    label: '负责人',   prop: 'ownerName',    width: 100, defaultVisible: false },
  { key: 'signPlace',    label: '签约地点', prop: 'signPlace',    width: 130, defaultVisible: false },
  { key: 'brand',        label: '品牌',     prop: 'brand',        width: 100, defaultVisible: false },
  { key: 'paybackMode',  label: '交付方式', prop: 'paybackMode',  width: 100, defaultVisible: false },
  { key: 'paybackDays',  label: '账期(天)', prop: 'paybackDays',  width: 90,  defaultVisible: false },
  { key: 'completeState', label: '完成状态', prop: 'completeState', width: 100, defaultVisible: false },
  { key: 'status',       label: '状态',     slotName: 'statusCell',   width: 90, defaultVisible: true },
  { key: 'actions',      label: '操作', type: 'actions', slotName: 'actionsCell', width: 150, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
];

const tableRef = ref<any>(null);

function fmt(d:string){ return d?new Date(d).toISOString().slice(0,10):'-'; }
async function load(){ data.value = await contractApi.list({...q}); }
function reset(){ Object.assign(q,{keyword:'',approvalState:'',page:1}); load(); }
function onSel(rows: any[]) { selected.value = rows; }
function onPageSize(){ q.page=1; load(); }
function go(p:number){ q.page=p; load(); }

async function onExport(cmd: string) {
  // 问题18：导出按当前表格显示列（用户配置）走
  const ids = cmd === 'selected' ? selected.value.map((r: any) => r.id) : [];
  const res: any = cmd === 'selected'
    ? data.value
    : await contractApi.list({ ...q, page: 1, pageSize: 99999 });
  const list = ids.length ? res.items.filter((r: any) => ids.includes(r.id)) : res.items;
  const expCols = tableRef.value?.getExportColumns?.() || [];
  const getters: Record<string, (row: any) => any> = {
    code: (r) => r.code,
    title: (r) => r.title,
    customerName: (r) => r.customerName,
    opportunityCode: (r) => r.opportunityCode || '',
    signDate: (r) => fmt(r.signDate),
    startDate: (r) => fmt(r.startDate),
    endDate: (r) => fmt(r.endDate),
    currencyCode: (r) => r.currencyCode || '',
    amountTotal: (r) => r.amountTotal,
    ownerName: (r) => r.ownerName || '',
    signPlace: (r) => r.signPlace || '',
    brand: (r) => r.brand || '',
    paybackMode: (r) => r.paybackMode || '',
    paybackDays: (r) => r.paybackDays ?? '',
    completeState: (r) => r.completeState || '',
    status: (r) => (r.approvalState === 'draft' ? '草稿' : '已审批'),
  };
  const header = expCols.map((c: any) => c.label);
  const lines = [header.join(',')];
  list.forEach((r: any) =>
    lines.push(
      expCols
        .map((c: any) => getters[c.key]?.(r) ?? '')
        .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  );
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '合同列表.csv';
  a.click();
}

// 进入详情/编辑/新建前保存查询条件，详情返回时恢复
function snapshotQuery() {
  sessionStorage.setItem('contractQuery', JSON.stringify({
    keyword: q.keyword,
    approvalState: q.approvalState,
    page: q.page,
    pageSize: q.pageSize,
  }));
}
function goView(row: any) {
  snapshotQuery();
  router.push(`/sales/contract/${row.id}?mode=view`);
}
function goEdit(row: any) {
  snapshotQuery();
  router.push(`/sales/contract/${row.id}`);
}
function goCreate() {
  snapshotQuery();
  router.push('/sales/contract/new');
}

async function remove(row:any){
  await ElMessageBox.confirm(`确认删除合同「${row.title}」？`,'提示',{type:'warning'});
  await contractApi.remove(row.id); ElMessage.success('已删除'); load();
}
function openPdf(row:any){
  const token = localStorage.getItem('token') || '';
  openPdfPreview(`${contractApi.pdfUrl(row.id)}?token=${token}`, `合同-${row.code || row.id}.pdf`);
}

onMounted(async () => {
  // 返回时从 sessionStorage 恢复查询条件
  const saved = sessionStorage.getItem('contractQuery');
  if (saved) {
    try {
      Object.assign(q, JSON.parse(saved));
      sessionStorage.removeItem('contractQuery');
    } catch {}
  }
  await load();
});
</script>
