<template>
  <div>
    <!-- 顶部条件区 -->
    <el-card style="margin-bottom: 14px">
      <template #header>
        <span style="font-weight: 600">📅 非销售日程管理筛选</span>
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
    <el-card>
      <table class="ws-table">
        <colgroup>
          <col style="width: 110px" />
          <col style="width: 140px" />
          <col style="width: 100px" />
          <col />
          <col style="width: 140px" />
          <col style="width: 110px" />
          <col style="width: 140px" />
        </colgroup>
        <tbody>
          <!-- 行 1：本周工作计划 -->
          <tr>
            <td :rowspan="18" class="time-range-cell">
              <div class="time-range-text">
                {{ timeRangeText }}
              </div>
            </td>
            <td class="field-cell">本周工作计划</td>
            <td colspan="4" class="content-cell">
              <textarea
                v-model="form.planText"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.planText) + 'px' }"
                rows="3"
                placeholder="请输入本周工作计划..."
              />
            </td>
          </tr>
          <!-- 行 2：本周工作总结 -->
          <tr>
            <td class="field-cell">本周工作总结</td>
            <td colspan="4" class="content-cell">
              <textarea
                v-model="form.summaryText"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.summaryText) + 'px' }"
                rows="3"
                placeholder="请输入本周工作总结..."
              />
            </td>
          </tr>
          <!-- 行 3：领导评定 -->
          <tr>
            <td class="field-cell">领导评定</td>
            <td colspan="4" class="content-cell">
              <textarea
                v-model="form.leaderComment"
                class="ws-textarea"
                :style="{ minHeight: textareaMinHeight(form.leaderComment) + 'px' }"
                rows="3"
                placeholder="请输入领导评定..."
              />
            </td>
          </tr>
          <!-- 行 4：表头 -->
          <tr class="header-row">
            <td>日期</td>
            <td>工作内容</td>
            <td>完成进度</td>
            <td>是否完成</td>
            <td>备注</td>
          </tr>

          <!-- 行 5-18：7 天 × 2 行 -->
          <template v-for="(day, dayIdx) in form.days" :key="dayIdx">
            <tr>
              <td class="field-cell" :rowspan="2">{{ day.dateLabel }}</td>
              <td class="period-cell">上午</td>
              <td class="content-cell">
                <textarea
                  v-model="day.am.content"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.am.content) + 'px' }"
                  placeholder="工作内容"
                />
              </td>
              <td class="content-cell">
                <textarea
                  v-model="day.am.progress"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.am.progress) + 'px' }"
                  placeholder="完成进度"
                />
              </td>
              <td class="content-cell">
                <el-select v-model="day.am.done" placeholder="是否完成" style="width: 100%">
                  <el-option label="是" :value="true" />
                  <el-option label="否" :value="false" />
                  <el-option label="—" :value="null" />
                </el-select>
              </td>
              <td class="content-cell">
                <textarea
                  v-model="day.am.remark"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.am.remark) + 'px' }"
                  placeholder="备注"
                />
              </td>
            </tr>
            <tr>
              <td class="period-cell">下午</td>
              <td class="content-cell">
                <textarea
                  v-model="day.pm.content"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.pm.content) + 'px' }"
                  placeholder="工作内容"
                />
              </td>
              <td class="content-cell">
                <textarea
                  v-model="day.pm.progress"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.pm.progress) + 'px' }"
                  placeholder="完成进度"
                />
              </td>
              <td class="content-cell">
                <el-select v-model="day.pm.done" placeholder="是否完成" style="width: 100%">
                  <el-option label="是" :value="true" />
                  <el-option label="否" :value="false" />
                  <el-option label="—" :value="null" />
                </el-select>
              </td>
              <td class="content-cell">
                <textarea
                  v-model="day.pm.remark"
                  class="ws-textarea"
                  :style="{ minHeight: dailyTextareaMinHeight(day.pm.remark) + 'px' }"
                  placeholder="备注"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { logger } from '@/utils/logger';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { weeklyScheduleApi, sysApi } from '@/api';

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const canViewOwnerFilter = computed(
  () => !!currentUser.isAdmin || (currentUser.roleCodes || []).includes('leader'),
);

// 人员下拉
const users = ref<any[]>([]);
async function loadUsers() {
  try {
    const data: any = await sysApi.users();
    users.value = Array.isArray(data) ? data : (data.items || []);
  } catch (e: any) {
    ElMessage.error('加载人员失败：' + (e?.message || e));
  }
}

// 周计算工具
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 周一 = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const WEEKDAY_LABELS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

/**
 * 顶部 3 段 textarea 最小高度估算（行 1-3 的 td colspan=4，约 600~900px 宽）
 * - 按 80 字/行 估算（与销售日程 textareaMinHeight 公式一致）
 * - 基础高度 60px，每行 22px
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

/**
 * 每天上午/下午 5 个 textarea 最小高度估算（td 列宽 100~140px，宽度不动）
 * - "工作内容"列最宽（auto，约 22 字/行中文），其余列 140px 同样按 22 字/行
 * - 基础高度 36px，每行 22px
 */
function dailyTextareaMinHeight(text: string | undefined): number {
  if (!text) return 36;
  const segments = text.split(/\n/);
  let totalLines = 0;
  for (const seg of segments) {
    totalLines += Math.max(1, Math.ceil((seg.length || 1) / 22));
  }
  return Math.max(36, 8 + totalLines * 22);
}

// 查询条件
const q = reactive({
  ownerId: undefined as number | undefined,
  startDate: '' as string,
  endDate: '' as string,
});

// 表单（按周）
const form = reactive({
  id: null as number | null,
  weekStart: '',
  planText: '',
  summaryText: '',
  leaderComment: '',
  days: [] as Array<{
    date: string;
    dateLabel: string;
    am: { content: string; progress: string; done: boolean | null; remark: string };
    pm: { content: string; progress: string; done: boolean | null; remark: string };
  }>,
});

// 初始化 7 天空骨架
function buildEmptyDays(startMonday: Date) {
  const days: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(startMonday, i);
    days.push({
      date: fmtDate(d),
      dateLabel: `${d.getDate()}日 ${WEEKDAY_LABELS[i]}`,
      am: { content: '', progress: '', done: null, remark: '' },
      pm: { content: '', progress: '', done: null, remark: '' },
    });
  }
  return days;
}

const timeRangeText = computed(() => {
  if (!q.startDate || !q.endDate) return '';
  const s = new Date(q.startDate);
  const e = new Date(q.endDate);
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日\n~\n${e.getFullYear()}年${e.getMonth() + 1}月${e.getDate()}日`;
});

// 日期选择器：起始时间只能选周一
function disabledStartDate(date: Date): boolean {
  const day = (date.getDay() + 6) % 7;
  return day !== 0;
}
// 日期选择器：终止时间只能选周日
function disabledEndDate(date: Date): boolean {
  const day = (date.getDay() + 6) % 7;
  return day !== 6;
}

// 起始 → 终止自动联动（+6 天）
watch(
  () => q.startDate,
  (val) => {
    if (!val) return;
    const s = new Date(val);
    const e = addDays(s, 6);
    q.endDate = fmtDate(e);
  },
);

// 当前 owner（admin 看 selected 否则 self）
const effectiveOwnerId = computed(() => {
  if (canViewOwnerFilter.value && q.ownerId) return q.ownerId;
  return currentUser.id;
});

async function fetchOne() {
  if (!q.startDate) return;
  try {
    const ownerId = canViewOwnerFilter.value ? q.ownerId : undefined;
    const data: any = await weeklyScheduleApi.get(q.startDate, ownerId);
    if (data) {
      form.id = data.id ?? null;
      form.planText = data.planText || '';
      form.summaryText = data.summaryText || '';
      form.leaderComment = data.leaderComment || '';
      // 合并 days：如果后端有 days，按日期填充；否则空骨架
      const startMonday = new Date(q.startDate);
      const emptyDays = buildEmptyDays(startMonday);
      if (Array.isArray(data.days) && data.days.length === 7) {
        for (let i = 0; i < 7; i++) {
          const d = data.days[i];
          emptyDays[i].am = {
            content: d?.am?.content || '',
            progress: d?.am?.progress || '',
            done: d?.am?.done ?? null,
            remark: d?.am?.remark || '',
          };
          emptyDays[i].pm = {
            content: d?.pm?.content || '',
            progress: d?.pm?.progress || '',
            done: d?.pm?.done ?? null,
            remark: d?.pm?.remark || '',
          };
        }
      }
      form.days = emptyDays;
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
  form.days = buildEmptyDays(startMonday);
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
  // 跨度检查
  const s = new Date(q.startDate);
  const e = new Date(q.endDate);
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays !== 6) {
    ElMessageBox.alert('时间跨度必须为一周（周一~周日，相差 6 天）', '提示', { type: 'warning' });
    return;
  }
  // 起始必须周一
  const sDay = (s.getDay() + 6) % 7;
  if (sDay !== 0) {
    ElMessageBox.alert('起始时间必须是周一', '提示', { type: 'warning' });
    return;
  }
  // 终止必须周日
  const eDay = (e.getDay() + 6) % 7;
  if (eDay !== 6) {
    ElMessageBox.alert('终止时间必须是周日', '提示', { type: 'warning' });
    return;
  }
  await fetchOne();
}

function shiftWeek(offsetDays: number) {
  // 当前以 q.startDate 为基准（若空则按本周）
  const cur = q.startDate ? new Date(q.startDate) : startOfWeek(new Date());
  const target = addDays(cur, offsetDays);
  q.startDate = fmtDate(target);
  // q.endDate 通过 watcher 自动联动
  fetchOne();
}
function onPrevWeek() {
  shiftWeek(-7);
}
function onNextWeek() {
  shiftWeek(7);
}

async function onSave() {
  if (!q.startDate) {
    ElMessageBox.alert('请先选择起始时间', '提示', { type: 'warning' });
    return;
  }
  // days 转纯数据
  const daysData = form.days.map((d) => ({
    date: d.date,
    am: { content: d.am.content, progress: d.am.progress, done: d.am.done, remark: d.am.remark },
    pm: { content: d.pm.content, progress: d.pm.progress, done: d.pm.done, remark: d.pm.remark },
  }));
  const ownerId = canViewOwnerFilter.value ? q.ownerId : undefined;
  try {
    await weeklyScheduleApi.save({
      weekStart: q.startDate,
      ownerId,
      planText: form.planText,
      summaryText: form.summaryText,
      leaderComment: form.leaderComment,
      days: daysData,
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
    const blob = await weeklyScheduleApi.exportBlob(q.startDate, ownerId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `周日程_${q.startDate}.xlsx`;
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
  if (canViewOwnerFilter.value) await loadUsers();
  // 默认显示当前一周
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
  table-layout: fixed;
  font-size: 13px;
  background: #fff;
}

.ws-table td {
  border: 1px solid #dcdfe6;
  padding: 4px 6px;
  vertical-align: top;
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
  resize: vertical;
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
</style>