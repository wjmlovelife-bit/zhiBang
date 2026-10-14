<template>
  <div>
    <!-- 顶部条件区 -->
    <el-card style="margin-bottom: 14px">
      <template #header>
        <span style="font-weight: 600">📅 销售日程管理筛选</span>
      </template>
      <el-form :inline="true" @submit.prevent>
        <el-form-item v-if="canViewOwnerFilter" label="人员">
          <el-select
            v-model="q.ownerId"
            placeholder="选择人员"
            clearable
            filterable
            style="width: 200px"
          >
            <el-option
              v-for="u in users"
              :key="u.id"
              :label="`${u.name}(${u.username})`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="起始时间">
          <el-date-picker
            v-model="q.startDate"
            type="date"
            placeholder="只能选周一"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledStartDate"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="终止时间">
          <el-date-picker
            v-model="q.endDate"
            type="date"
            placeholder="只能选周日"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledEndDate"
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="onPrevWeek">上一周</el-button>
          <el-button @click="onNextWeek">下一周</el-button>
          <el-button type="success" @click="onSave">保存</el-button>
          <el-dropdown trigger="click" @command="onExport">
            <el-button type="warning">
              导出<el-icon style="margin-left: 4px"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 主体表格 -->
    <el-card class="sales-schedule-card">
      <table class="ws-table">
          <colgroup>
            <col style="width: 9%" />   <!-- 1 时间范围 不变 -->
            <col style="width: 5%" />   <!-- 2 日期 -->
            <col style="width: 5%" />   <!-- 3 上下午 -->
            <col style="width: 20%" />  <!-- 4 当日总结 R38 加宽 (10%→20%) -->
            <col style="width: 4%" />   <!-- 5 日程 R38 缩窄 (14%→4%) -->
            <col style="width: 7%" />   <!-- 6 客户 -->
            <col style="width: 7%" />   <!-- 7 项目 -->
            <col style="width: 4%" />   <!-- 8 联系人 -->
            <col style="width: 5%" />   <!-- 9 里程碑 -->
            <col style="width: 34%" />  <!-- 10 跟进情况 不变 -->
          </colgroup>
        <tbody>
          <!-- 顶部 3 段（计划/总结/评定），时间范围在第一行 rowspan 贯穿整表 -->
          <tr>
            <td :rowspan="totalRows" class="time-range-cell">
              <div class="time-range-text">{{ timeRangeText }}</div>
            </td>
            <td>本周工作计划</td>
            <td colspan="9" class="content-cell">
              <textarea
                v-model="form.planText"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.planText) + 'px' }"
                placeholder="请输入本周工作计划..."
              />
            </td>
          </tr>
          <tr>
            <td>本周工作总结</td>
            <td colspan="9" class="content-cell">
              <textarea
                v-model="form.summaryText"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.summaryText) + 'px' }"
                placeholder="请输入本周工作总结..."
              />
            </td>
          </tr>
          <tr>
            <td>领导评定</td>
            <td colspan="9" class="content-cell">
              <textarea
                v-model="form.leaderComment"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.leaderComment) + 'px' }"
                placeholder="请输入领导评定..."
              />
            </td>
          </tr>
          <!-- 表头 -->
          <tr class="header-row">
            <td>日期</td>
            <td>上下午</td>
            <td>当日总结</td>
            <td>日程</td>
            <td>客户</td>
            <td>项目</td>
            <td>联系人</td>
            <td>里程碑</td>
            <td>跟进情况</td>
          </tr>

          <!-- 数据行 -->
          <template v-for="(day, dayIdx) in form.days" :key="dayIdx">
            <!-- 上午 follow 行（可能 0~N 行） -->
            <template v-for="(cell, ci) in day.am" :key="`am-${dayIdx}-${ci}`">
              <tr>
                <td v-if="ci === 0" :rowspan="day.am.length + day.pm.length" class="field-cell">
                  {{ day.dateLabel }}
                </td>
                <td class="period-cell">上午</td>
                <td v-if="ci === 0" :rowspan="day.am.length + day.pm.length" class="day-summary-cell">
                  <textarea
                    v-model="day.daySummary"
                    :ref="(el) => setTextareaRef(el, dayIdx)"
                    class="day-summary-textarea"
                    placeholder="请输入当日总结..."
                    rows="1"
                    @input="autoResize"
                  />
                </td>
                <td class="content-cell">{{ cell.schedule || '—' }}</td>
                <td class="content-cell">
                  <router-link
                    v-if="cell.customerId"
                    :to="`/sales/customer/${cell.customerId}/detail`"
                    class="link"
                    @click="saveReturnState"
                  >{{ cell.customer }}</router-link>
                  <span v-else>{{ cell.customer || '—' }}</span>
                </td>
                <td class="content-cell">
                  <router-link
                    v-if="cell.projectId"
                    :to="{ path: `/sales/project/${cell.projectId}`, query: { mode: 'view' } }"
                    class="link"
                    @click="saveReturnState"
                  >{{ cell.project }}</router-link>
                  <span v-else>{{ cell.project || '—' }}</span>
                </td>
                <td class="content-cell">
                  <el-tag
                    v-for="(n, i) in cell.contactNames"
                    :key="i"
                    size="small"
                    style="margin-right: 4px; margin-bottom: 2px"
                  >{{ n }}</el-tag>
                  <span v-if="!cell.contactNames?.length">—</span>
                </td>
                <td class="content-cell">{{ cell.milestone || '—' }}</td>
                <td class="content-cell" :style="{ minHeight: rowMinHeight(cell.content) + 'px' }">
                  <div class="content-wrap">{{ cell.content || '—' }}</div>
                </td>
              </tr>
            </template>
            <!-- 下午 follow 行（可能 0~N 行） -->
            <template v-for="(cell, ci) in day.pm" :key="`pm-${dayIdx}-${ci}`">
              <tr>
                <td v-if="ci === 0 && !day.am.length" :rowspan="day.pm.length" class="field-cell">
                  {{ day.dateLabel }}
                </td>
                <td class="period-cell">下午</td>
                <td v-if="ci === 0 && !day.am.length" :rowspan="day.pm.length" class="day-summary-cell">
                  <textarea
                    v-model="day.daySummary"
                    :ref="(el) => setTextareaRef(el, dayIdx)"
                    class="day-summary-textarea"
                    placeholder="请输入当日总结..."
                    rows="1"
                    @input="autoResize"
                  />
                </td>
                <td class="content-cell">{{ cell.schedule || '—' }}</td>
                <td class="content-cell">
                  <router-link
                    v-if="cell.customerId"
                    :to="`/sales/customer/${cell.customerId}/detail`"
                    class="link"
                    @click="saveReturnState"
                  >{{ cell.customer }}</router-link>
                  <span v-else>{{ cell.customer || '—' }}</span>
                </td>
                <td class="content-cell">
                  <router-link
                    v-if="cell.projectId"
                    :to="{ path: `/sales/project/${cell.projectId}`, query: { mode: 'view' } }"
                    class="link"
                    @click="saveReturnState"
                  >{{ cell.project }}</router-link>
                  <span v-else>{{ cell.project || '—' }}</span>
                </td>
                <td class="content-cell">
                  <el-tag
                    v-for="(n, i) in cell.contactNames"
                    :key="i"
                    size="small"
                    style="margin-right: 4px; margin-bottom: 2px"
                  >{{ n }}</el-tag>
                  <span v-if="!cell.contactNames?.length">—</span>
                </td>
                <td class="content-cell">{{ cell.milestone || '—' }}</td>
                <td class="content-cell" :style="{ minHeight: rowMinHeight(cell.content) + 'px' }">
                  <div class="content-wrap">{{ cell.content || '—' }}</div>
                </td>
              </tr>
            </template>
            <!-- 当日完全无 follow 时，仍显示一行空骨架保持表格框架 -->
            <tr v-if="!day.am.length && !day.pm.length">
              <td class="field-cell">{{ day.dateLabel }}</td>
              <td class="period-cell">—</td>
              <td class="day-summary-cell">
                <textarea
                  v-model="day.daySummary"
                  :ref="(el) => setTextareaRef(el, dayIdx)"
                  class="day-summary-textarea"
                  placeholder="请输入当日总结..."
                  rows="1"
                  @input="autoResize"
                />
              </td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
              <td class="content-cell">—</td>
            </tr>
          </template>
        </tbody>
      </table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { logger } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { salesScheduleApi, sysApi } from '@/api';

const router = useRouter();

/**
 * 跳详情前保存当前筛选条件 + 滚动位置 → sessionStorage
 * 详情页返回时 onMounted 读取恢复
 */
function saveReturnState() {
  sessionStorage.setItem('salesScheduleReturn', JSON.stringify({
    ownerId: q.ownerId,
    startDate: q.startDate,
    endDate: q.endDate,
    scrollY: window.scrollY,
  }));
}

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const canViewOwnerFilter = computed(
  () => !!currentUser.isAdmin || (currentUser.roleCodes || []).includes('leader'),
);

const users = ref<any[]>([]);
async function loadUsers() {
  try {
    const data: any = await sysApi.users();
    users.value = Array.isArray(data) ? data : (data.items || []);
  } catch (e: any) {
    ElMessage.error('加载人员失败：' + (e?.message || e));
  }
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * 跟进情况列：按内容估算最小高度（让 td 撑高，整行跟随）
 * - 按换行符分行 + 中文每 ~22 字/行 估算
 * - 每行 ~24px，基础高度 32px
 */
function rowMinHeight(text: string | undefined): number {
  if (!text) return 32;
  // 按 \n 分段
  const segments = text.split(/\n/);
  let totalLines = 0;
  for (const seg of segments) {
    // 每 22 字一行（中文为主），最少 1 行
    totalLines += Math.max(1, Math.ceil((seg.length || 1) / 22));
  }
  return Math.max(32, 8 + totalLines * 24);
}

/**
 * 顶部 3 段 textarea 最小高度估算（让 textarea 撑高显示完整内容）
 * - 顶部 textarea 宽度比"跟进情况"列大很多（约 3 倍），按 80 字/行 估算
 * - 基础高度 60px（约 3 行），每行 22px
 */
function textareaMinHeight(text: string | undefined): number {
  if (!text) return 60;
  const segments = text.split(/\n/);
  let totalLines = 0;
  for (const seg of segments) {
    totalLines += Math.max(1, Math.ceil((seg.length || 1) / 80));
  }
  return Math.max(60, 8 + totalLines * 22);
}

const WEEKDAY_LABELS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

const q = reactive({
  ownerId: undefined as number | undefined,
  startDate: '' as string,
  endDate: '' as string,
});

interface DayCell {
  schedule: string;
  customer: string;
  customerCode: string;
  project: string;
  projectCode: string;
  contactNames: string[];
  milestone: string;
  content: string;
  followDate: string;
  followType: string;
}

const form = reactive({
  id: null as number | null,
  weekStart: '',
  planText: '',
  summaryText: '',
  leaderComment: '',
  days: [] as Array<{
    date: string;
    dateLabel: string;
    daySummary: string;   // R37 当日总结（用户手动输入，跨上下午一行）
    am: DayCell[];
    pm: DayCell[];
  }>,
});

const timeRangeText = computed(() => {
  if (!q.startDate || !q.endDate) return '';
  const s = new Date(q.startDate);
  const e = new Date(q.endDate);
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日\n~\n${e.getFullYear()}年${e.getMonth() + 1}月${e.getDate()}日`;
});

/**
 * 表格总行数（用于时间范围 rowspan）
 * = 顶部3段 + 表头1行 + 7天 × (am/pm follow 数 + 空骨架)
 */
const totalRows = computed(() => {
  let dataRows = 0;
  for (const day of form.days) {
    if (day.am.length || day.pm.length) {
      dataRows += day.am.length + day.pm.length;
    } else {
      dataRows += 1; // 兜底空骨架
    }
  }
  return 3 + 1 + dataRows; // 顶部3段 + 表头 + 数据
});

function disabledStartDate(date: Date): boolean {
  const day = (date.getDay() + 6) % 7;
  return day !== 0;
}
function disabledEndDate(date: Date): boolean {
  const day = (date.getDay() + 6) % 7;
  return day !== 6;
}

watch(
  () => q.startDate,
  (val) => {
    if (!val) return;
    const s = new Date(val);
    const e = addDays(s, 6);
    q.endDate = fmtDate(e);
  },
);

// R43 当日总结 textarea 自适应高度：原生 textarea + JS scrollHeight（避免 el-input 组件层风险）
const taRefs = ref<any[]>([]);
function setTextareaRef(el: any, dayIdx: number) {
  if (el) taRefs.value[dayIdx] = el;
}
function autoResize(e: Event) {
  const ta = e.target as HTMLTextAreaElement;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
// 初次渲染/数据变化时触发一次（处理回显+数据更新后高度重算）
watch(
  () => form.days.map((d) => `${d.date}|${d.daySummary ?? ''}`).join('||'),
  () => {
    nextTick(() => {
      taRefs.value.forEach((ta) => {
        if (ta) {
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
        }
      });
    });
  },
  { immediate: true },
);

async function fetchOne() {
  if (!q.startDate) return;
  const ownerId = canViewOwnerFilter.value ? q.ownerId : undefined;
  try {
    const data: any = await salesScheduleApi.get(q.startDate, ownerId);
    if (data) {
      form.id = data.id ?? null;
      form.planText = data.planText || '';
      form.summaryText = data.summaryText || '';
      form.leaderComment = data.leaderComment || '';
      form.days = (data.days || []).map((d: any) => ({
        date: d.date,
        dateLabel: d.dateLabel,
        daySummary: d.daySummary || '',  // R37 当日总结（兼容历史数据无此字段）
        am: d.am || [],
        pm: d.pm || [],
      }));
      form.weekStart = q.startDate;
    } else {
      resetForm();
    }
  } catch (e: any) {
    logger.error(e);
    ElMessage.error('加载周数据失败：' + (e?.message || e));
    resetForm();
  }
}

function resetForm() {
  const startMonday = q.startDate ? new Date(q.startDate) : startOfWeek(new Date());
  form.id = null;
  form.planText = '';
  form.summaryText = '';
  form.leaderComment = '';
  form.days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(startMonday, i);
    form.days.push({
      date: fmtDate(d),
      dateLabel: `${d.getDate()}日 ${WEEKDAY_LABELS[i]}`,
      daySummary: '',
      am: [],
      pm: [],
    });
  }
  form.weekStart = fmtDate(startMonday);
}

async function onQuery() {
  if (!q.startDate) {
    ElMessageBox.alert('请选择起始时间', '提示', { type: 'warning' });
    return;
  }
  if (!q.endDate) {
    ElMessageBox.alert('请选择终止时间', '提示', { type: 'warning' });
    return;
  }
  const s = new Date(q.startDate);
  const e = new Date(q.endDate);
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays !== 6) {
    ElMessageBox.alert('时间跨度必须为一周（周一~周日，相差 6 天）', '提示', { type: 'warning' });
    return;
  }
  const sDay = (s.getDay() + 6) % 7;
  if (sDay !== 0) {
    ElMessageBox.alert('起始时间必须是周一', '提示', { type: 'warning' });
    return;
  }
  const eDay = (e.getDay() + 6) % 7;
  if (eDay !== 6) {
    ElMessageBox.alert('终止时间必须是周日', '提示', { type: 'warning' });
    return;
  }
  await fetchOne();
}

function shiftWeek(offsetDays: number) {
  const cur = q.startDate ? new Date(q.startDate) : startOfWeek(new Date());
  const target = addDays(cur, offsetDays);
  q.startDate = fmtDate(target);
  fetchOne();
}
function onPrevWeek() { shiftWeek(-7); }
function onNextWeek() { shiftWeek(7); }

async function onSave() {
  if (!q.startDate) {
    ElMessageBox.alert('请先选择起始时间', '提示', { type: 'warning' });
    return;
  }
  const ownerId = canViewOwnerFilter.value ? q.ownerId : undefined;
  try {
    await salesScheduleApi.save({
      weekStart: q.startDate,
      ownerId,
      planText: form.planText,
      summaryText: form.summaryText,
      leaderComment: form.leaderComment,
      days: form.days,  // R42 修复：让后端接收并保存当日总结（daySummary），同时让 R17.3.2 快照完整冻结
    });
    ElMessage.success('保存成功');
    await fetchOne();
  } catch (e: any) {
    logger.error(e);
    ElMessage.error('保存失败：' + (e?.message || e));
  }
}

async function onExport(cmd: string) {
  if (!q.startDate) {
    ElMessageBox.alert('请先选择起始时间', '提示', { type: 'warning' });
    return;
  }
  const ownerId = canViewOwnerFilter.value ? q.ownerId : undefined;
  try {
    const blob = await salesScheduleApi.exportBlob(q.startDate, ownerId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `销售日程_${q.startDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (e: any) {
    logger.error(e);
    ElMessage.error('导出失败：' + (e?.message || e));
  }
}

onMounted(async () => {
  // 优先恢复 sessionStorage（从详情页返回的场景）
  const saved = sessionStorage.getItem('salesScheduleReturn');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      q.ownerId = data.ownerId;
      q.startDate = data.startDate;
      q.endDate = data.endDate;
      if (canViewOwnerFilter.value) await loadUsers();
      await fetchOne();
      await nextTick();
      window.scrollTo(0, data.scrollY || 0);
    } catch (e) {
      logger.error('restore salesScheduleReturn failed', e);
    } finally {
      sessionStorage.removeItem('salesScheduleReturn');
    }
    return;
  }
  // 默认进入：本周
  if (canViewOwnerFilter.value) await loadUsers();
  const today = new Date();
  const m = startOfWeek(today);
  q.startDate = fmtDate(m);
  q.endDate = fmtDate(addDays(m, 6));
  await fetchOne();
});
</script>

<style scoped>
.ws-table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 13px;
  background: #fff;
  margin: 0;
}

.ws-table td {
  border: 1px solid #dcdfe6;
  padding: 4px 6px;
  vertical-align: top;
}

.ws-table thead td {
  font-weight: 600;
  background: #e6f1ff;
}

.ws-table tbody td {
  background: #fff;
}

.time-range-cell {
  text-align: center;
  vertical-align: middle;
  background: #f5f7fa;
  font-weight: 600;
  font-size: 14px;
  white-space: pre-wrap;
}

.time-range-text {
  writing-mode: horizontal-tb;
}

.field-cell {
  background: #f5f7fa;
  text-align: center;
  font-weight: 600;
  vertical-align: middle;
  white-space: nowrap;
}

/* R37/R38/R39/R43 当日总结列：
   - R39 用 absolute 撑满 cell（已废弃，固定高度无法显示全部文字）
   - R43 改用 JS autoResize + 原生 textarea，宽度不变、textarea 高度 = scrollHeight（自适应内容）*/
.day-summary-cell {
  background: #fafbfc;
  vertical-align: top;
  padding: 4px 6px;     /* R43: 恢复 padding（不再 absolute 撑满） */
}
.day-summary-cell .day-summary-textarea {
  width: 100%;
  height: auto;          /* R43: 高度由 JS scrollHeight 决定 */
  min-height: 36px;      /* R43: 最小高度（空内容时占点空间） */
  resize: none;          /* R43: 禁手动 resize（自适应高度已够用） */
  overflow: hidden;      /* R43: 隐藏滚动条（高度足够不滚动） */
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.5;
  font-family: inherit;
  box-sizing: border-box;
  background: #fff;
  display: block;
}
.day-summary-cell .day-summary-textarea:focus {
  outline: none;
  border-color: #409eff;
}

.period-cell {
  text-align: center;
  vertical-align: middle;
  font-weight: 500;
  background: #fafafa;
}

.header-row td {
  background: #e6f1ff;
  text-align: center;
  font-weight: 600;
}

.content-cell {
  background: #fff;
  padding: 4px;
}

.ws-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 4px;
  font-size: 13px;
  font-family: inherit;
  background: transparent;
  box-sizing: border-box;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-all;
}

.ws-textarea:focus {
  background: #fffbe6;
}

/* 跟进情况列：高度随内容自适应（用 rowMinHeight 函数估算），宽度不变 */
.content-wrap {
  white-space: pre-wrap;
  word-break: break-all;
  padding: 4px 0;
  line-height: 24px;
  font-size: 13px;
}

/* 客户名/项目名 → 详情页链接 */
.link {
  color: var(--color-text-link, #185fa5);
  text-decoration: underline;
  cursor: pointer;
}
.link:hover {
  opacity: 0.8;
}
</style>