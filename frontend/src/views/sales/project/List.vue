<template>
  <div>
    <el-card>
    <el-form :inline="true" @submit.prevent>
      <el-form-item label="关键词">
        <el-input v-model="q.keyword" placeholder="主题/编号" clearable @keyup.enter="load" style="width: 160px" />
      </el-form-item>
      <el-form-item label="客户">
        <el-select v-model="q.customerId" filterable clearable remote :remote-method="searchCustomer" @change="onCustomerChange" placeholder="输入客户名/编号搜索" style="width: 200px">
          <el-option v-for="c in customerOpts" :key="c.id" :label="`${c.code} ${c.name}`" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="项目分类">
        <el-select v-model="q.category" clearable placeholder="全部" @change="load" style="width: 130px">
          <el-option v-for="o in opt.category" :key="o" :label="o" :value="o" />
        </el-select>
      </el-form-item>
        <el-form-item label="项目阶段">
          <el-select v-model="q.stage" clearable placeholder="全部" @change="load" style="width: 130px">
            <el-option v-for="o in opt.stage" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责销售人">
          <el-select v-if="isAdmin" v-model="q.ownerId" filterable clearable placeholder="全部" @change="load" style="width: 130px">
            <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
          <span v-else style="color: #909399; font-size: 13px">（仅管理员可筛选）</span>
        </el-form-item>
        <el-form-item label="发现日期">
          <el-date-picker v-model="q.dateOpen" type="daterange" value-format="YYYY-MM-DD" @change="onDate" />
        </el-form-item>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>

      <div v-if="q.customerId" style="margin-bottom: 12px; color: #409eff; font-size: 13px">
        正在按客户筛选：{{ q.customerName || ('#' + q.customerId) }}
        <el-button link type="primary" size="small" @click="clearCustomer">清除筛选</el-button>
      </div>

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
        <el-button type="primary" @click="$router.push('/sales/project/new')">新增项目</el-button>
        <!-- R23 2026-09-29 临时关闭：项目导入功能调试中（admin 也不可见，等调试好再放开）
             恢复：删掉下方注释行 + 把上方按钮行放开（已加 v-perm 兜底 + DB 权限码已建好）
             也可改成 <el-button v-perm="'crm:project:import'" @click="$router.push('/sales/project/import')">导入</el-button> -->
        <!-- <el-button v-perm="'crm:project:import'" @click="$router.push('/sales/project/import')">导入</el-button> -->
        <el-button type="warning" :disabled="!selected.length" @click="inheritVisible = true">继承给他人</el-button>
      </div>

      <ConfigurableTable
        ref="tableRef"
        page-key="projectList"
        :columns="columns"
        :data="data.items"
        border
        :default-sort="defaultSort"
        @selection-change="onSel"
        @sort-change="onSort"
      >
        <template #ownerCell="{ row }">{{ row.owner?.name || '-' }}</template>
        <template #customerCell="{ row }">{{ row.customer ? `${row.customer.name}(${row.customer.code})` : '-' }}</template>
        <template #dateOpenCell="{ row }">{{ fmt(row.dateOpen) }}</template>
        <template #lastFollowCell="{ row }">{{ fmt(row.lastFollowDate) }}</template>
        <template #inheritDateCell="{ row }">{{ fmt(row.inheritDate) }}</template>
        <template #contractCell="{ row }">{{ row.contract ? `${row.contract.code}(${row.contract.title})` : '-' }}</template>
        <template #statusCell="{ row }">
          <el-tag :type="row.submitStatus === 'draft' ? 'warning' : 'success'">
            {{ row.submitStatus === 'draft' ? '草稿' : '正式' }}
          </el-tag>
        </template>
        <template #updatedAtCell="{ row }">{{ fmt(row.updatedAt) }}</template>
        <template #actionsCell="{ row }">
          <el-button link type="info" @click="goDetail(row.id)">查看</el-button>
          <el-button link type="primary" @click="$router.push(`/sales/project/${row.id}`)">编辑</el-button>
          <el-button link type="primary" @click="openPdf(row)">PDF</el-button>
          <el-button v-if="isAdmin" link type="danger" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="inheritVisible" title="继承给他人" width="420px">
      <el-select v-model="inheritTo" filterable placeholder="选择销售用户" style="width: 100%">
        <el-option v-for="u in users" :key="u.id" :label="`${u.name}(${u.username})`" :value="u.id" />
      </el-select>
      <el-input v-model="inheritReason" placeholder="继承原因（可选）" style="margin-top: 12px" />
      <template #footer>
        <el-button @click="inheritVisible = false">取消</el-button>
        <el-button type="primary" @click="doInherit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectApi, sysApi } from '@/api';
import { openPdfPreview } from '@/composables/usePdfPreview';
import ConfigurableTable from '@/components/ConfigurableTable.vue';
import type { ColumnDef } from '@/composables/useColumnConfig';

const route = useRoute();
const router = useRouter();

// 问题18：表格字段可定制
const columns: ColumnDef[] = [
  { key: 'selection', label: '', type: 'selection', width: 46, fixed: 'left', lockVisible: true, lockPosition: true, defaultVisible: true },
  { key: 'code',         label: '项目编号',   prop: 'code',         width: 130, defaultVisible: true, sortable: true },
  { key: 'owner',        label: '负责销售人', prop: 'owner', slotName: 'ownerCell',     width: 110, defaultVisible: true, sortable: true },
  { key: 'name',         label: '项目主题',   prop: 'name',         minWidth: 160, defaultVisible: true, sortable: true },
  { key: 'customer',     label: '关联客户',   prop: 'customer', slotName: 'customerCell',  width: 160, defaultVisible: false, sortable: true },
  { key: 'dateOpen',     label: '发现日期',   prop: 'dateOpen', slotName: 'dateOpenCell',  width: 120, defaultVisible: true, sortable: true },
  { key: 'lastFollow',   label: '洽谈日期',   prop: 'lastFollow', slotName: 'lastFollowCell', width: 120, defaultVisible: true, sortable: true },
  { key: 'inheritDate',  label: '领用日期',   slotName: 'inheritDateCell', width: 120, defaultVisible: false },
  { key: 'category',     label: '项目分类',   prop: 'category',     width: 100, defaultVisible: false, sortable: true },
  { key: 'stage',        label: '阶段',       prop: 'stage',        width: 100, defaultVisible: true, sortable: true },
  { key: 'source',       label: '项目来源',   prop: 'source',       width: 110, defaultVisible: false, sortable: true },
  { key: 'state',        label: '项目状态',   prop: 'state',        width: 90,  defaultVisible: false, sortable: true },
  { key: 'currencyCode', label: '币种',       prop: 'currencyCode', width: 80,  defaultVisible: false, sortable: true },
  { key: 'expectedRevenue', label: '项目总额', prop: 'expectedRevenue', width: 120, defaultVisible: false, sortable: true },
  { key: 'amountFinal',  label: '优惠后总额', prop: 'amountFinal',  width: 130, defaultVisible: false, sortable: true },
  { key: 'plannedCost',  label: '预计费用',   prop: 'plannedCost',  width: 110, defaultVisible: false, sortable: true },
  { key: 'contract',     label: '关联合同',   prop: 'contract', slotName: 'contractCell',  width: 160, defaultVisible: false, sortable: true },
  { key: 'status',       label: '状态',       prop: 'status', slotName: 'statusCell',    width: 80, defaultVisible: true, sortable: true },
  { key: 'updatedAt',    label: '更新时间', prop: 'updatedAt', slotName: 'updatedAtCell', width: 120, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true, sortable: true },
  { key: 'actions',      label: '操作', type: 'actions', slotName: 'actionsCell', width: 160, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
];

const tableRef = ref<any>(null);

const opt = {
  category: ['系统集成', '电磁兼容', '仪表销售', '仪器租赁', '代客户购', '过单转售'],
  stage: ['初期沟通', '立项评估', '方案制定', '招投标', '商务谈判', '合同签订', '长期合作'],
  source: ['电话咨询', '客户介绍', '独立开发', '展会活动', '公司分派'],
  state: ['成功', '失败', '延误', '跟踪', '初期跟进'],
  currency: ['人民币', '美元', '欧元', '日元', '英镑', '港币', '其他'],
};

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const isAdmin = computed(() => currentUser.dataScope === 1);

const q = reactive({ keyword: '', category: '', stage: '', ownerId: '', customerId: '', customerName: '', dateOpenStart: '', dateOpenEnd: '', page: 1, pageSize: 10, sortField: 'updatedAt', sortOrder: 'desc' });
const data = ref<any>({ total: 0, items: [] });
const selected = ref<any[]>([]);
const totalPages = computed(() => Math.max(1, Math.ceil(data.value.total / q.pageSize)));
const users = ref<any[]>([]);
const customerOpts = ref<any[]>([]);
const inheritVisible = ref(false);
const inheritTo = ref<number>();
const inheritReason = ref('');

function fmt(d: string) {
  return d ? new Date(d).toISOString().slice(0, 10) : '-';
}

async function load() {
  data.value = await projectApi.list({ ...q });
}
function reset() {
  Object.assign(q, { keyword: '', category: '', stage: '', ownerId: '', customerId: '', customerName: '', dateOpenStart: '', dateOpenEnd: '', page: 1, sortField: 'updatedAt', sortOrder: 'desc' });
  router && router.replace({ path: '/sales/project' });
  load();
}
async function searchCustomer(kw: string) {
  if (!kw) return;
  customerOpts.value = await projectApi.searchCustomer(kw);
}
function onCustomerChange() {
  const c = customerOpts.value.find((x: any) => x.id === q.customerId);
  q.customerName = c?.name || '';
  load();
}
function clearCustomer() {
  q.customerId = '';
  q.customerName = '';
  router.replace({ path: '/sales/project' });
  load();
}
function onDate(v: any) {
  q.dateOpenStart = v?.[0] || '';
  q.dateOpenEnd = v?.[1] || '';
  load();
}
function onSel(rows: any[]) {
  selected.value = rows;
}

// 表头排序：el-table 自定义排序，触发后端排序
const defaultSort = computed(() => ({
  prop: q.sortField || 'updatedAt',
  order: (q.sortOrder === 'asc' ? 'ascending' : 'descending') as 'ascending' | 'descending',
}));

function onSort(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!payload.order) {
    // 第三次点击表头：恢复默认（更新时间倒序）
    q.sortField = 'updatedAt';
    q.sortOrder = 'desc';
  } else {
    q.sortField = payload.prop;
    q.sortOrder = payload.order === 'ascending' ? 'asc' : 'desc';
  }
  load();
}
function onPageSize() {
  q.page = 1;
  load();
}
function go(p: number) {
  q.page = p;
  load();
}
async function onExport(cmd: string) {
  // 问题18：导出按当前表格显示列（用户配置）走，而不是走后端 PDF 接口
  const ids = cmd === 'selected' ? selected.value.map((r) => r.id) : [];
  const res: any = cmd === 'selected'
    ? data.value
    : await projectApi.list({ ...q, page: 1, pageSize: 99999 });
  const list = ids.length ? res.items.filter((r: any) => ids.includes(r.id)) : res.items;
  const expCols = tableRef.value?.getExportColumns?.() || [];
  const getters: Record<string, (row: any) => any> = {
    code: (r) => r.code,
    owner: (r) => r.owner?.name || '',
    name: (r) => r.name,
    customer: (r) => (r.customer ? `${r.customer.name}(${r.customer.code})` : ''),
    dateOpen: (r) => fmt(r.dateOpen),
    lastFollow: (r) => fmt(r.lastFollowDate),
    inheritDate: (r) => fmt(r.inheritDate),
    category: (r) => r.category || '',
    stage: (r) => r.stage || '',
    source: (r) => r.source || '',
    state: (r) => r.state || '',
    currencyCode: (r) => r.currencyCode || '',
    expectedRevenue: (r) => r.expectedRevenue ?? '',
    amountFinal: (r) => r.amountFinal ?? '',
    plannedCost: (r) => r.plannedCost ?? '',
    contract: (r) => (r.contract ? `${r.contract.code}(${r.contract.title})` : ''),
    status: (r) => (r.submitStatus === 'draft' ? '草稿' : '正式'),
    updatedAt: (r) => fmt(r.updatedAt),
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
  a.download = '项目列表.csv';
  a.click();
}
function openPdf(row: any) {
  const token = localStorage.getItem('token') || '';
  openPdfPreview(`${projectApi.pdfUrl(row.id)}?token=${token}`, `项目-${row.code || row.id}.pdf`);
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除项目「${row.name}」？`, '提示', { type: 'warning' });
  await projectApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}
async function doInherit() {
  if (!inheritTo.value) return ElMessage.warning('请选择接收人');
  await projectApi.inherit(selected.value[0].id, inheritTo.value, inheritReason.value);
  ElMessage.success('已继承');
  inheritVisible.value = false;
  load();
}

// 问题14：进入详情前保存查询条件，返回时恢复
function goDetail(id: number) {
  sessionStorage.setItem('projectQuery', JSON.stringify({
    keyword: q.keyword,
    category: q.category,
    stage: q.stage,
    ownerId: q.ownerId,
    customerId: q.customerId,
    dateOpenStart: q.dateOpenStart,
    dateOpenEnd: q.dateOpenEnd,
    page: q.page,
    pageSize: q.pageSize,
  }));
  router.push(`/sales/project/${id}?mode=view`);
}

onMounted(async () => {
  // 问题14：权限控制 - 管理员可筛选全部人员，普通用户默认只看自己
  if (isAdmin.value) {
    users.value = await sysApi.users();
  } else {
    q.ownerId = currentUser.id;
  }

  // 问题14：返回时恢复查询条件
  const saved = sessionStorage.getItem('projectQuery');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      Object.assign(q, s);
      sessionStorage.removeItem('projectQuery');
    } catch {}
  }

  const cid = Number(route.query.customerId) || 0;
  if (cid) {
    q.customerId = cid;
    q.customerName = (route.query.customerName as string) || '';
    if (!q.customerName) {
      const c = await projectApi.searchCustomer(String(cid));
      const hit = (c || []).find((x: any) => x.id === cid);
      q.customerName = hit?.name || '';
    }
    customerOpts.value = q.customerName ? [{ id: cid, code: '', name: q.customerName }] : [];
  }
  await load();
});
</script>
