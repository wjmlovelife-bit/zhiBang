<!--
  销售数据统计（数据统计 > 销售数据统计）
  - 人员下拉（可选）+ 起始/结束日期（可选）+ 查询/重置
  - 4 指标卡：新增客户 / 新增项目 / 客户总数 / 项目总数
  - 人员明细表（人员/部门/新增客户/新增项目/客户累计/项目累计 + 合计行）
  - 导出按钮：导出全部 / 导出选中（当前筛选条件下的人）
  - 权限：仅 admin（后端 + 前端侧栏菜单控制）
-->
<template>
  <div>
    <el-card>
      <!-- 筛选区 -->
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="人员">
          <el-select v-model="filters.userId" clearable filterable placeholder="所有人（默认）" style="width: 180px">
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.name}（${u.username}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker
            v-model="filters.dateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可选"
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="filters.dateTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可选"
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="load">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
        <el-form-item style="float: right">
          <el-button
            type="success"
            :disabled="!data"
            @click="exportAll"
          >
            导出全部
          </el-button>
          <el-button
            type="warning"
            :disabled="!filters.userId"
            @click="exportSelected"
          >
            导出选中
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 4 指标卡 -->
      <div v-if="data" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0">
        <el-card shadow="never" style="background: var(--el-fill-color-light)">
          <div style="font-size: 13px; color: var(--el-text-color-secondary)">新增客户</div>
          <div style="font-size: 28px; font-weight: 500; color: #185fa5">{{ data.total.newCustomers }}</div>
        </el-card>
        <el-card shadow="never" style="background: var(--el-fill-color-light)">
          <div style="font-size: 13px; color: var(--el-text-color-secondary)">新增项目</div>
          <div style="font-size: 28px; font-weight: 500; color: #639922">{{ data.total.newProjects }}</div>
        </el-card>
        <el-card shadow="never" style="background: var(--el-fill-color-light)">
          <div style="font-size: 13px; color: var(--el-text-color-secondary)">客户总数</div>
          <div style="font-size: 28px; font-weight: 500">{{ data.total.customerCount }}</div>
        </el-card>
        <el-card shadow="never" style="background: var(--el-fill-color-light)">
          <div style="font-size: 13px; color: var(--el-text-color-secondary)">项目总数</div>
          <div style="font-size: 28px; font-weight: 500">{{ data.total.projectCount }}</div>
        </el-card>
      </div>

      <!-- 人员明细表 -->
      <el-table v-if="data" :data="data.perUser" border stripe style="margin-top: 8px">
        <el-table-column label="人员" min-width="160">
          <template #default="{ row }">{{ row.name }}（{{ row.username }}）</template>
        </el-table-column>
        <el-table-column prop="deptName" label="部门" min-width="120" />
        <el-table-column prop="newCustomers" label="新增客户" width="110" align="right" />
        <el-table-column prop="newProjects" label="新增项目" width="110" align="right" />
        <el-table-column prop="customerCount" label="客户累计" width="110" align="right" />
        <el-table-column prop="projectCount" label="项目累计" width="110" align="right" />
        <el-table-column v-if="data.perUser.length === 0" label="说明">
          <template #default>
            <span style="color: var(--el-text-color-secondary)">
              没有符合条件的人员（所有人名下都没有客户/项目）
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 合计行（始终展示） -->
      <div v-if="data" style="display: flex; justify-content: flex-end; padding: 12px 0; border-top: 0.5px solid var(--el-border-color-lighter); font-size: 13px">
        <span style="margin-right: 24px">合计：新增客户 <b>{{ data.total.newCustomers }}</b></span>
        <span style="margin-right: 24px">新增项目 <b>{{ data.total.newProjects }}</b></span>
        <span style="margin-right: 24px">客户累计 <b>{{ data.total.customerCount }}</b></span>
        <span>项目累计 <b>{{ data.total.projectCount }}</b></span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { sysApi, statsApi } from '@/api';
import { useUserStore } from '@/store/user';

/**
 * 本地年月日拼成 YYYY-MM-DD（避免 toISOString() 的 UTC 偏差导致跨日错位）
 */
function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 给定日期，返回「本周一」的 YYYY-MM-DD（中国习惯：周一为一周首日）
 * 例：周三 9月23日 → '2026-09-21'；周日 9月27日 → '2026-09-21'（往前6天）
 */
function weekStartISO(d: Date = new Date()): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = dt.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const diffToMon = dow === 0 ? 6 : dow - 1;
  dt.setDate(dt.getDate() - diffToMon);
  return fmtLocalDate(dt);
}

/** 今天 YYYY-MM-DD */
function todayISO(d: Date = new Date()): string {
  return fmtLocalDate(d);
}

interface SalesSummaryRow {
  userId: number;
  username: string;
  name: string;
  deptName: string;
  newCustomers: number;
  newProjects: number;
  customerCount: number;
  projectCount: number;
}
interface SalesSummary {
  total: { newCustomers: number; newProjects: number; customerCount: number; projectCount: number };
  perUser: SalesSummaryRow[];
}

const userStore = useUserStore();
// 默认时间范围：本周一 ~ 今天（中国习惯，留空 = 全部数据）
const filters = ref<{ userId?: number; dateFrom?: string; dateTo?: string }>({
  dateFrom: weekStartISO(),
  dateTo: todayISO(),
});
const data = ref<SalesSummary | null>(null);
const loading = ref(false);
const userOptions = ref<{ id: number; name: string; username: string }[]>([]);

async function loadUserOptions() {
  try {
    const list: any[] = await sysApi.users();
    userOptions.value = (list || [])
      .filter((u) => u.isActive)
      .map((u) => ({ id: u.id, name: u.name, username: u.username }));
  } catch {
    ElMessage.error('加载人员列表失败');
  }
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      userId: filters.value.userId,
      dateFrom: filters.value.dateFrom,
      dateTo: filters.value.dateTo,
    };
    const res: any = await statsApi.salesSummary(params);
    data.value = res?.data || res || null;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '查询失败');
    data.value = null;
  } finally {
    loading.value = false;
  }
}

function load() {
  loadData();
}
function reset() {
  // 重置回到「本周一 ~ 今天」默认值（用户清空过日期框也会再恢复）
  filters.value = {
    dateFrom: weekStartISO(),
    dateTo: todayISO(),
  };
  loadData();
}

// 导出全部：当前筛选条件下的所有行
async function exportAll() {
  const url = statsApi.salesExportUrl({
    userId: filters.value.userId,
    dateFrom: filters.value.dateFrom,
    dateTo: filters.value.dateTo,
  });
  // 用 store 里的 token 拼 query（与现有 PDF 预览同模式，避免 axios blob 重定向）
  const token = userStore.token || localStorage.getItem('token') || '';
  const sep = url.includes('?') ? '&' : '?';
  window.location.href = `${url}${token ? sep + 'token=' + encodeURIComponent(token) : ''}`;
}

// 导出选中：选中某个人员（userId 必填）
async function exportSelected() {
  if (!filters.value.userId) {
    ElMessage.warning('请先在「人员」下拉中选择具体人员，再点击导出选中');
    return;
  }
  const url = statsApi.salesExportUrl({
    userId: filters.value.userId,
    dateFrom: filters.value.dateFrom,
    dateTo: filters.value.dateTo,
  });
  const token = userStore.token || localStorage.getItem('token') || '';
  const sep = url.includes('?') ? '&' : '?';
  window.location.href = `${url}${token ? sep + 'token=' + encodeURIComponent(token) : ''}`;
}

onMounted(async () => {
  await loadUserOptions();
  await loadData();
});
</script>

<style scoped>
.el-card {
  margin-bottom: 16px;
}
</style>