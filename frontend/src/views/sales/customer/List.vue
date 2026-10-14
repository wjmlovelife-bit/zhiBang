<template>
  <div>
    <el-card>
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="名称/编号" clearable @keyup.enter="load" style="width: 160px" />
        </el-form-item>
        <el-form-item label="客户分类">
          <el-select v-model="q.category" clearable placeholder="全部" @change="load" style="width: 130px">
            <el-option v-for="o in opt.category" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进程度">
          <el-select v-model="q.followStage" clearable placeholder="全部" @change="load" style="width: 130px">
            <el-option v-for="o in opt.followStage" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="价值评估">
          <el-select v-model="q.valueRating" clearable placeholder="全部" @change="load" style="width: 110px">
            <el-option v-for="o in opt.valueRating" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户行业">
          <el-select v-model="q.industry" clearable placeholder="全部" @change="load" style="width: 150px">
            <el-option v-for="o in opt.industry" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isAdmin" label="负责销售人">
          <el-select v-model="q.ownerId" clearable placeholder="全部" @change="load" style="width: 140px">
            <el-option v-for="u in users" :key="u.id" :label="`${u.name}(${u.username})`" :value="u.id" />
          </el-select>
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
        <el-button type="primary" @click="$router.push('/sales/customer/new')">新增客户</el-button>
        <!-- R23 2026-09-29 临时关闭：客户导入功能调试中（admin 也不可见，等调试好再放开）
             恢复：删掉下方注释行 + 把上方按钮行放开（已加 v-perm 兜底 + DB 权限码已建好）
             也可改成 <el-button v-perm="'crm:customer:import'" @click="$router.push('/sales/customer/import')">导入</el-button> -->
        <!-- <el-button v-perm="'crm:customer:import'" @click="$router.push('/sales/customer/import')">导入</el-button> -->
        <el-button type="warning" :disabled="!selected.length" @click="inheritVisible = true">继承给他人</el-button>
      </div>

      <ConfigurableTable
        ref="tableRef"
        page-key="customerList"
        :columns="columns"
        :data="data.items"
        border
        :default-sort="defaultSort"
        @selection-change="onSel"
        @sort-change="onSort"
      >
        <template #ownerCell="{ row }">{{ row.owner?.name || '-' }}</template>
        <template #contactsCell="{ row }">{{ row.contacts?.[0]?.name || '-' }}</template>
        <template #contactPhoneCell="{ row }">{{ row.contacts?.[0]?.mobile || row.contacts?.[0]?.officePhone || '-' }}</template>
        <template #contactWechatCell="{ row }">{{ row.contacts?.[0]?.wechat || '-' }}</template>
        <template #createdAtCell="{ row }">{{ fmt(row.createdAt) }}</template>
        <template #inheritDateCell="{ row }">{{ fmt(row.inheritDate) }}</template>
        <template #attachmentCountCell="{ row }">{{ (row.attachments || []).length }}</template>
        <template #statusCell="{ row }">
          <el-tag :type="row.submitStatus === 'draft' ? 'warning' : 'success'">
            {{ row.submitStatus === 'draft' ? '草稿' : '正式' }}
          </el-tag>
        </template>
        <template #updatedAtCell="{ row }">{{ fmt(row.updatedAt) }}</template>
        <template #actionsCell="{ row }">
          <el-button link type="primary" @click="goDetail(row.id)">查看</el-button>
          <el-button link type="primary" @click="$router.push(`/sales/customer/${row.id}`)">编辑</el-button>
          <el-button link type="success" @click="$router.push({ path: '/sales/project', query: { customerId: row.id, customerName: row.name } })">项目</el-button>
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
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { customerApi, sysApi } from '@/api';
import ConfigurableTable from '@/components/ConfigurableTable.vue';
import type { ColumnDef } from '@/composables/useColumnConfig';

const router = useRouter();

// 问题18：表格字段可定制
// 候选列：所有可能显示的字段；defaultVisible 决定首次是否显示
const columns: ColumnDef[] = [
  { key: 'selection', label: '', type: 'selection', width: 46, fixed: 'left', lockVisible: true, lockPosition: true, defaultVisible: true },
  { key: 'code', label: '客户编号', prop: 'code', width: 130, defaultVisible: true, sortable: true },
  { key: 'owner', label: '负责销售人', prop: 'owner', slotName: 'ownerCell', width: 110, defaultVisible: true, sortable: true },
  { key: 'name', label: '客户名称', prop: 'name', minWidth: 140, defaultVisible: true, sortable: true },
  { key: 'contacts', label: '联系人', slotName: 'contactsCell', width: 100, defaultVisible: true },
  { key: 'contactPhone', label: '联系人电话', slotName: 'contactPhoneCell', width: 120, defaultVisible: false },
  { key: 'contactWechat', label: '联系人微信', slotName: 'contactWechatCell', width: 120, defaultVisible: false },
  { key: 'followStage', label: '洽谈进展', prop: 'followStage', width: 110, defaultVisible: true, sortable: true },
  { key: 'createdAt', label: '建立日期', prop: 'createdAt', slotName: 'createdAtCell', width: 120, defaultVisible: true, sortable: true },
  { key: 'inheritDate', label: '领用日期', slotName: 'inheritDateCell', width: 120, defaultVisible: false },
  { key: 'status', label: '状态', prop: 'status', slotName: 'statusCell', width: 80, defaultVisible: true, sortable: true },
  // 问题19：字段加全
  { key: 'category', label: '客户分类', prop: 'category', width: 110, defaultVisible: false, sortable: true },
  { key: 'type', label: '客户类型', prop: 'type', width: 90, defaultVisible: false, sortable: true },
  { key: 'source', label: '客户来源', prop: 'source', width: 110, defaultVisible: false, sortable: true },
  { key: 'industry', label: '客户行业', prop: 'industry', width: 110, defaultVisible: false, sortable: true },
  { key: 'valueRating', label: '价值评估', prop: 'valueRating', width: 90, defaultVisible: false, sortable: true },
  { key: 'creditLevel', label: '信用等级', prop: 'creditLevel', width: 90, defaultVisible: false, sortable: true },
  { key: 'currencyCode', label: '币种', prop: 'currencyCode', width: 80, defaultVisible: false, sortable: true },
  { key: 'address', label: '客户地址', prop: 'address', minWidth: 160, defaultVisible: false, sortable: true },
  { key: 'legalPerson', label: '法人代表', prop: 'legalPerson', width: 100, defaultVisible: false, sortable: true },
  { key: 'registeredCapital', label: '注册资本', prop: 'registeredCapital', width: 110, defaultVisible: false, sortable: true },
  { key: 'bankName', label: '开户银行', prop: 'bankName', width: 140, defaultVisible: false, sortable: true },
  { key: 'bankAccount', label: '银行账号', prop: 'bankAccount', width: 140, defaultVisible: false, sortable: true },
  { key: 'taxId', label: '税号', prop: 'taxId', width: 130, defaultVisible: false, sortable: true },
  { key: 'invoiceTitle', label: '开票抬头', prop: 'invoiceTitle', width: 160, defaultVisible: false, sortable: true },
  { key: 'paymentDays', label: '账期(天)', prop: 'paymentDays', width: 90, defaultVisible: false, sortable: true },
  { key: 'attachmentCount', label: '附件数', slotName: 'attachmentCountCell', width: 80, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', prop: 'updatedAt', slotName: 'updatedAtCell', width: 120, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true, sortable: true },
  { key: 'actions', label: '操作', type: 'actions', slotName: 'actionsCell', width: 250, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
];

const tableRef = ref<any>(null);
const opt = {
  category: ['终端公司', '分销', '集成商', '招标公司'],
  followStage: ['初期沟通', '跟进中', '商务谈判', '已成交', '已流失'],
  valueRating: ['高', '中', '低'],
  industry: ['国防军工', '科研院所', '检测机构', '大专院校', '分销渠道', '电子制造', '芯片制造', '汽车电子', '石油化工', '能源电力', '其他行业'],
};

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const isAdmin = computed(() => currentUser.dataScope === 1);

const q = reactive({ keyword: '', category: '', followStage: '', valueRating: '', industry: '', ownerId: '', page: 1, pageSize: 10, sortField: 'updatedAt', sortOrder: 'desc' });
const data = ref<any>({ total: 0, items: [] });
const selected = ref<any[]>([]);
const totalPages = computed(() => Math.max(1, Math.ceil(data.value.total / q.pageSize)));
const inheritVisible = ref(false);
const inheritTo = ref<number>();
const inheritReason = ref('');
const users = ref<any[]>([]);

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

async function load() {
  const res: any = await customerApi.list({ ...q });
  data.value = res?.data ?? res;
}
function reset() {
  Object.assign(q, { keyword: '', category: '', followStage: '', valueRating: '', industry: '', ownerId: '', page: 1, sortField: 'updatedAt', sortOrder: 'desc' });
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
  const ids = cmd === 'selected' ? selected.value.map((r) => r.id) : [];
  const res: any = await customerApi.list({ ...q, page: 1, pageSize: 99999 });
  const rows = ids.length ? res.items.filter((r: any) => ids.includes(r.id)) : res.items;
  // 问题18：导出按当前表格显示列（用户配置）走，而不是写死
  const expCols = tableRef.value?.getExportColumns?.() || [];
  // 给每列补充 getValue（含复杂列的渲染逻辑，复用表格里的格式化）
  const getters: Record<string, (row: any) => any> = {
    code: (r) => r.code,
    owner: (r) => r.owner?.name || '',
    name: (r) => r.name,
    contacts: (r) => r.contacts?.[0]?.name || '',
    contactPhone: (r) => r.contacts?.[0]?.mobile || r.contacts?.[0]?.officePhone || '',
    contactWechat: (r) => r.contacts?.[0]?.wechat || '',
    followStage: (r) => r.followStage,
    createdAt: (r) => fmt(r.createdAt),
    inheritDate: (r) => fmt(r.inheritDate),
    status: (r) => (r.submitStatus === 'draft' ? '草稿' : '正式'),
    updatedAt: (r) => fmt(r.updatedAt),
    // 问题19：字段加全
    category: (r) => r.category || '',
    type: (r) => r.type || '',
    source: (r) => r.source || '',
    industry: (r) => r.industry || '',
    valueRating: (r) => r.valueRating || '',
    creditLevel: (r) => r.creditLevel || '',
    currencyCode: (r) => r.currencyCode || '',
    address: (r) => r.address || '',
    legalPerson: (r) => r.legalPerson || '',
    registeredCapital: (r) => r.registeredCapital ?? '',
    bankName: (r) => r.bankName || '',
    bankAccount: (r) => r.bankAccount || '',
    taxId: (r) => r.taxId || '',
    invoiceTitle: (r) => r.invoiceTitle || '',
    paymentDays: (r) => r.paymentDays ?? '',
    attachmentCount: (r) => (r.attachments || []).length,
  };
  const header = expCols.map((c: any) => c.label);
  const lines = [header.join(',')];
  for (const r of rows)
    lines.push(
      expCols
        .map((c: any) => getters[c.key]?.(r) ?? '')
        .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'customers.csv';
  a.click();
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除客户「${row.name}」？`, '提示', { type: 'warning' });
  await customerApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}
async function doInherit() {
  if (!inheritTo.value) return ElMessage.warning('请选择接收人');
  await customerApi.inherit(selected.value[0].id, inheritTo.value, inheritReason.value);
  ElMessage.success('已继承');
  inheritVisible.value = false;
  load();
}

// 问题14：进入详情前保存查询条件，返回时恢复
function goDetail(id: number) {
  sessionStorage.setItem('customerQuery', JSON.stringify({
    keyword: q.keyword,
    category: q.category,
    followStage: q.followStage,
    valueRating: q.valueRating,
    industry: q.industry,
    ownerId: q.ownerId,
    page: q.page,
    pageSize: q.pageSize,
  }));
  router.push(`/sales/customer/${id}/detail`);
}

onMounted(async () => {
  // 问题14：权限控制 - 管理员可筛选全部人员，普通用户默认只看自己
  if (isAdmin.value) {
    users.value = await sysApi.users();
  } else {
    q.ownerId = currentUser.id;
  }

  // 问题14：返回时恢复查询条件
  const saved = sessionStorage.getItem('customerQuery');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      Object.assign(q, s);
      sessionStorage.removeItem('customerQuery');
    } catch {}
  }

  await load();
});
</script>
