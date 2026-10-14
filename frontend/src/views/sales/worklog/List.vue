<template>
  <div>
    <!-- ① 顶部筛选卡片（独立） -->
    <el-card style="margin-bottom: 14px">
      <template #header>
        <span style="font-weight: 600">🎯 工作日志筛选</span>
      </template>
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="关键词">
          <el-input
            v-model="q.keyword"
            placeholder="内容/编号/周总结"
            clearable
            @keyup.enter="applyFilters"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item v-if="canViewOwnerFilter" label="人员">
          <el-select
            v-model="q.ownerId"
            clearable
            placeholder="全部"
            style="width: 160px"
            @change="applyFilters"
          >
            <el-option v-for="u in users" :key="u.id" :label="`${u.name}(${u.username})`" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联客户">
          <el-select
            v-model="q.customerId"
            clearable
            filterable
            remote
            placeholder="输入搜索"
            :remote-method="searchCustomer"
            @change="applyFilters"
            style="width: 180px"
          >
            <el-option v-for="c in customerOpts" :key="c.id" :label="`${c.name}(${c.code})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联项目">
          <el-select
            v-model="q.projectId"
            clearable
            filterable
            remote
            placeholder="输入搜索"
            :remote-method="searchProject"
            @change="applyFilters"
            style="width: 180px"
          >
            <el-option v-for="p in projectOpts" :key="p.id" :label="`${p.name}(${p.code})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            @change="onDate"
            style="width: 240px"
          />
        </el-form-item>
        <el-button type="primary" @click="applyFilters">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
    </el-card>

    <!-- ② 本周工作总结 -->
    <el-card style="margin-bottom: 14px">
      <template #header>
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-weight: 600">📝 本周工作总结</span>
          <span style="color: #909399; font-size: 12px">第一页含本周占位（如未填写）</span>
          <el-button type="primary" size="small" @click="openWeeklyDialog({})">新增周总结</el-button>
        </div>
      </template>
      <ConfigurableTable
        ref="weeklyTableRef"
        page-key="worklogWeeklyList"
        :columns="weeklyColumns"
        :data="weeklyList"
        border
      >
        <template #extra-columns>
          <el-table-column v-if="canViewOwnerFilter" label="人员" width="140">
            <template #default="{ row }">
              {{ row.owner?.name ? `${row.owner.name}(${row.owner.username})` : '-' }}
            </template>
          </el-table-column>
        </template>
        <template #weekRangeCell="{ row }">
          <span style="font-weight: 500">{{ weekRangeText(row.weekStart) }}</span>
          <el-tag v-if="row.id" size="small" type="success" style="margin-left: 8px">已填写</el-tag>
          <el-tag v-else size="small" type="info" style="margin-left: 8px">未填写</el-tag>
        </template>
        <template #planCell="{ row }">
          <div style="white-space: pre-wrap; word-break: break-all; max-height: 80px; overflow: auto;">{{ row.plan || '—' }}</div>
        </template>
        <template #contentCell="{ row }">
          <div style="white-space: pre-wrap; word-break: break-all; max-height: 80px; overflow: auto;">{{ row.content || '—' }}</div>
        </template>
        <template #actionsCell="{ row }">
          <el-button v-if="row.id" link type="info" @click="viewWeeklyDialog(row)">查看</el-button>
          <el-button link type="primary" @click="openWeeklyDialog(row)">编辑</el-button>
          <el-button v-if="row.id && canEditWeekly(row)" link type="danger" @click="deleteWeekly(row)">删除</el-button>
        </template>
      </ConfigurableTable>

      <div class="pager">
        <span>共 {{ weeklyPager.total }} 条 / {{ weeklyPager.totalPages }} 页</span>
        <el-select v-model="weeklyPager.pageSize" style="width: 100px" @change="onWeeklyPageSize">
          <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="`${s}条/页`" :value="s" />
        </el-select>
        <el-button :disabled="weeklyPager.page <= 1" @click="loadWeeklyPage(weeklyPager.page - 1)">上一页</el-button>
        <el-button :disabled="weeklyPager.page >= weeklyPager.totalPages" @click="loadWeeklyPage(weeklyPager.page + 1)">下一页</el-button>
      </div>
    </el-card>

    <!-- 本周总结 编辑弹窗 -->
    <el-dialog
      v-model="weeklyDialogVisible"
      :title="weeklyViewMode ? `本周工作总结 · ${weekRangeText(weeklyForm.weekStart)}（只读）` : `本周工作总结 · ${weekRangeText(weeklyForm.weekStart)}`"
      width="680px"
      destroy-on-close
    >
      <el-form label-width="80px">
        <el-form-item label="周开始">
          <el-date-picker
            v-model="weeklyForm.weekStart"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择周一"
            :disabled="weeklyViewMode"
          />
        </el-form-item>
        <el-form-item label="本周工作计划">
          <el-input
            v-model="weeklyForm.plan"
            type="textarea"
            :rows="5"
            placeholder="填写本周工作计划"
            :disabled="weeklyViewMode"
          />
        </el-form-item>
        <el-form-item label="总结内容">
          <el-input
            v-model="weeklyForm.content"
            type="textarea"
            :rows="5"
            placeholder="填写本周工作总结"
            :disabled="weeklyViewMode"
          />
        </el-form-item>
        <el-form-item label="附件">
          <AttachmentUploader v-model="weeklyForm.attachments" :disabled="weeklyViewMode" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="weeklyViewMode" @click="weeklyDialogVisible = false">关闭</el-button>
        <template v-else>
          <el-button @click="weeklyDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingWeekly" @click="saveWeekly">保存</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- ③ 工作日志列表查询 -->
    <el-card style="margin-bottom: 14px">
      <template #header>
        <span style="font-weight: 600">📊 工作日志列表查询</span>
      </template>

      <div style="margin: 8px 0 12px; color: #909399; font-size: 12px">
        已按时间段筛选：下方两张表分别展示该时段内「客户信息变更」与「项目信息变更」，点击行可查看详情。统计区间：{{ data.changeRange?.start || '-' }} ~ {{ data.changeRange?.end || '-' }}
      </div>

      <div style="margin-bottom: 12px; display: flex; gap: 8px">
        <el-dropdown @command="onExport">
          <el-button>导出<span style="margin-left: 4px">▾</span></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部</el-dropdown-item>
              <el-dropdown-item command="selected" :disabled="!selected.length">导出选中</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" @click="$router.push('/sales/worklog/new')">新增日志</el-button>
      </div>

      <ConfigurableTable
        ref="logTableRef"
        page-key="worklogList"
        :columns="logColumns"
        :data="data.items"
        border
        @selection-change="onSel"
      >
        <template #codeCell="{ row }">{{ row.code || (row.isVirtual ? '—' : '-') }}</template>
        <template #typeCell="{ row }">
          <el-tag :type="typeTag(row.type)" size="small">{{ row.type || '日志' }}</el-tag>
        </template>
        <template #ownerCell="{ row }">{{ row.owner?.name || row.ownerName || '-' }}</template>
        <template #dateCell="{ row }">{{ fmt(row.date) }}</template>
        <template #customerCell="{ row }">{{ row.customer ? `${row.customer.name}(${row.customer.code})` : '-' }}</template>
        <template #projectCell="{ row }">{{ row.project ? `${row.project.name}(${row.project.code})` : '-' }}</template>
        <template #contentCell="{ row }">{{ (row.content || '').slice(0, 60) }}</template>
        <template #actionsCell="{ row }">
          <el-button link type="info" @click="goView(row.id, 'view')">查看</el-button>
          <el-button link type="primary" @click="goView(row.id)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
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

    <!-- ④ 客户信息变更表 -->
    <el-card style="margin-top: 16px">
      <template #header>
        <span style="font-weight: 600">📊 客户信息变更（该时段内有更新的客户）</span>
      </template>
      <ConfigurableTable
        ref="custTableRef"
        page-key="worklogCustomerChangeList"
        :columns="customerChangeColumns"
        :data="changedCustomersItems"
        border
      >
        <template #ownerCell="{ row }">{{ row.owner?.name || '-' }}</template>
        <template #contactPhoneCell="{ row }">{{ row.contacts?.[0]?.mobile || row.contacts?.[0]?.officePhone || '-' }}</template>
        <template #createdAtCell="{ row }">{{ fmt(row.createdAt) }}</template>
        <template #inheritDateCell="{ row }">{{ fmt(row.inheritDate) }}</template>
        <template #attachmentCountCell="{ row }">{{ (row.attachments || []).length }}</template>
        <template #statusCell="{ row }">
          <el-tag :type="row.submitStatus === 'draft' ? 'warning' : 'success'">
            {{ row.submitStatus === 'draft' ? '草稿' : '正式' }}
          </el-tag>
        </template>
        <template #actionsCell="{ row }">
          <el-button link type="primary" @click="goCustomer(row.id, 'detail')">查看</el-button>
          <el-button link type="primary" @click="goCustomer(row.id)">编辑</el-button>
        </template>
      </ConfigurableTable>

      <div class="pager">
        <span>共 {{ customerPager.total }} 条 / {{ customerPager.totalPages }} 页</span>
        <el-select v-model="customerPager.pageSize" style="width: 100px" @change="onCustomerPageSize">
          <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="`${s}条/页`" :value="s" />
        </el-select>
        <el-button :disabled="customerPager.page <= 1" @click="loadCustomerPage(customerPager.page - 1)">上一页</el-button>
        <el-button :disabled="customerPager.page >= customerPager.totalPages" @click="loadCustomerPage(customerPager.page + 1)">下一页</el-button>
      </div>
    </el-card>

    <!-- ⑤ 项目信息变更表 -->
    <el-card style="margin-top: 16px">
      <template #header>
        <span style="font-weight: 600">📊 项目信息变更（该时段内有更新的项目）</span>
      </template>
      <ConfigurableTable
        ref="projTableRef"
        page-key="worklogProjectChangeList"
        :columns="projectChangeColumns"
        :data="changedProjectsItems"
        border
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
        <template #actionsCell="{ row }">
          <el-button link type="info" @click="goProject(row.id, 'view')">查看</el-button>
          <el-button link type="primary" @click="goProject(row.id)">编辑</el-button>
        </template>
      </ConfigurableTable>

      <div class="pager">
        <span>共 {{ projectPager.total }} 条 / {{ projectPager.totalPages }} 页</span>
        <el-select v-model="projectPager.pageSize" style="width: 100px" @change="onProjectPageSize">
          <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="`${s}条/页`" :value="s" />
        </el-select>
        <el-button :disabled="projectPager.page <= 1" @click="loadProjectPage(projectPager.page - 1)">上一页</el-button>
        <el-button :disabled="projectPager.page >= projectPager.totalPages" @click="loadProjectPage(projectPager.page + 1)">下一页</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref, onMounted, computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { worklogApi, sysApi } from '@/api';
  import AttachmentUploader from '@/components/AttachmentUploader.vue';
  import ConfigurableTable from '@/components/ConfigurableTable.vue';
  import type { ColumnDef } from '@/composables/useColumnConfig';

  const route = useRoute();
  const router = useRouter();

  // 问题18：表格字段可定制（4 张表，每张独立 pageKey）
  const weeklyColumns: ColumnDef[] = [
    { key: 'weekRange',  label: '周范围',   slotName: 'weekRangeCell',  width: 180, defaultVisible: true },
    { key: 'plan',       label: '本周工作计划', slotName: 'planCell',    minWidth: 220, defaultVisible: true },
    { key: 'content',    label: '总结内容', slotName: 'contentCell',   minWidth: 260, defaultVisible: true },
    { key: 'actions',    label: '操作', type: 'actions', slotName: 'actionsCell', width: 200, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
  ];
  const logColumns: ColumnDef[] = [
    { key: 'selection', label: '', type: 'selection', width: 46, fixed: 'left', lockVisible: true, lockPosition: true, defaultVisible: true },
    { key: 'code',     label: '日志编号', slotName: 'codeCell',     width: 150, defaultVisible: true },
    { key: 'type',     label: '类型',     slotName: 'typeCell',     width: 110, defaultVisible: true },
    { key: 'owner',    label: '人员',     slotName: 'ownerCell',    width: 120, defaultVisible: true },
    { key: 'date',     label: '日期',     slotName: 'dateCell',     width: 120, defaultVisible: true },
    { key: 'customer', label: '关联客户', slotName: 'customerCell', width: 160, defaultVisible: true },
    { key: 'project',  label: '关联项目', slotName: 'projectCell',  width: 160, defaultVisible: true },
    { key: 'content',  label: '内容',     slotName: 'contentCell',  minWidth: 200, defaultVisible: true },
    { key: 'duration', label: '耗时(h)', prop: 'duration',         width: 90,  defaultVisible: true },
    { key: 'actions',  label: '操作', type: 'actions', slotName: 'actionsCell', width: 170, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
  ];
  const customerChangeColumns: ColumnDef[] = [
    { key: 'code',         label: '客户编号',   prop: 'code',         width: 130, defaultVisible: true },
    { key: 'owner',        label: '负责销售人', slotName: 'ownerCell',         width: 110, defaultVisible: true },
    { key: 'name',         label: '客户名称',   prop: 'name',         minWidth: 140, defaultVisible: true },
    { key: 'contactName',  label: '联系人',     prop: 'contactName',  width: 100, defaultVisible: true },
    { key: 'contactPhone', label: '联系人电话', slotName: 'contactPhoneCell', width: 120, defaultVisible: false },
    { key: 'followStage',  label: '洽谈进展',   prop: 'followStage',  width: 110, defaultVisible: true },
    { key: 'createdAt',    label: '建立日期',   slotName: 'createdAtCell', width: 120, defaultVisible: true },
    { key: 'inheritDate',  label: '领用日期',   slotName: 'inheritDateCell', width: 120, defaultVisible: false },
    { key: 'status',       label: '状态',       slotName: 'statusCell',       width: 80, defaultVisible: true },
    // 问题19：字段加全（参照客户 List）
    { key: 'category',     label: '客户分类',   prop: 'category',     width: 110, defaultVisible: false },
    { key: 'type',         label: '客户类型',   prop: 'type',         width: 90,  defaultVisible: false },
    { key: 'source',       label: '客户来源',   prop: 'source',       width: 110, defaultVisible: false },
    { key: 'industry',     label: '客户行业',   prop: 'industry',     width: 110, defaultVisible: false },
    { key: 'valueRating',  label: '价值评估',   prop: 'valueRating',  width: 90,  defaultVisible: false },
    { key: 'creditLevel',  label: '信用等级',   prop: 'creditLevel',  width: 90,  defaultVisible: false },
    { key: 'currencyCode', label: '币种',       prop: 'currencyCode', width: 80,  defaultVisible: false },
    { key: 'address',      label: '客户地址',   prop: 'address',      minWidth: 160, defaultVisible: false },
    { key: 'legalPerson',  label: '法人代表',   prop: 'legalPerson',  width: 100, defaultVisible: false },
    { key: 'registeredCapital', label: '注册资本', prop: 'registeredCapital', width: 110, defaultVisible: false },
    { key: 'bankName',     label: '开户银行',   prop: 'bankName',     width: 140, defaultVisible: false },
    { key: 'bankAccount',  label: '银行账号',   prop: 'bankAccount',  width: 140, defaultVisible: false },
    { key: 'taxId',        label: '税号',       prop: 'taxId',        width: 130, defaultVisible: false },
    { key: 'invoiceTitle', label: '开票抬头',   prop: 'invoiceTitle', width: 160, defaultVisible: false },
    { key: 'paymentDays',  label: '账期(天)',   prop: 'paymentDays',  width: 90,  defaultVisible: false },
    { key: 'attachmentCount', label: '附件数', slotName: 'attachmentCountCell', width: 80, defaultVisible: false },
    { key: 'actions',      label: '操作', type: 'actions', slotName: 'actionsCell', width: 150, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
  ];
  const projectChangeColumns: ColumnDef[] = [
    { key: 'code',         label: '项目编号',   prop: 'code',         width: 130, defaultVisible: true },
    { key: 'owner',        label: '负责销售人', slotName: 'ownerCell',         width: 110, defaultVisible: true },
    { key: 'name',         label: '项目主题',   prop: 'name',         minWidth: 160, defaultVisible: true },
    { key: 'customer',     label: '关联客户',   slotName: 'customerCell', width: 160, defaultVisible: false },
    { key: 'dateOpen',     label: '发现日期',   slotName: 'dateOpenCell',     width: 120, defaultVisible: true },
    { key: 'lastFollow',   label: '洽谈日期',   slotName: 'lastFollowCell',   width: 120, defaultVisible: true },
    { key: 'inheritDate',  label: '领用日期',   slotName: 'inheritDateCell',  width: 120, defaultVisible: false },
    { key: 'category',     label: '项目分类',   prop: 'category',     width: 100, defaultVisible: false },
    { key: 'stage',        label: '阶段',       prop: 'stage',        width: 100, defaultVisible: true },
    { key: 'source',       label: '项目来源',   prop: 'source',       width: 110, defaultVisible: false },
    { key: 'state',        label: '项目状态',   prop: 'state',        width: 90,  defaultVisible: false },
    { key: 'currencyCode', label: '币种',       prop: 'currencyCode', width: 80,  defaultVisible: false },
    { key: 'expectedRevenue', label: '项目总额', prop: 'expectedRevenue', width: 120, defaultVisible: false },
    { key: 'amountFinal',  label: '优惠后总额', prop: 'amountFinal',  width: 130, defaultVisible: false },
    { key: 'plannedCost',  label: '预计费用',   prop: 'plannedCost',  width: 110, defaultVisible: false },
    { key: 'contract',     label: '关联合同',   slotName: 'contractCell',  width: 160, defaultVisible: false },
    { key: 'status',       label: '状态',       slotName: 'statusCell',       width: 80, defaultVisible: true },
    { key: 'actions',      label: '操作', type: 'actions', slotName: 'actionsCell', width: 150, fixed: 'right', lockVisible: true, lockPosition: true, defaultVisible: true },
  ];
  const weeklyTableRef = ref<any>(null);
  const logTableRef = ref<any>(null);
  const custTableRef = ref<any>(null);
  const projTableRef = ref<any>(null);

  // 共享筛选条件（4 个模块共用）
  const q = reactive({
    keyword: '',
    ownerId: '' as number | string | '',
    customerId: '' as number | string | '',
    projectId: '' as number | string | '',
    dateStart: '',
    dateEnd: '',
    page: 1,
    pageSize: 10,
  });
  const dateRange = ref<any>([]);

  // ② 本周工作总结
  const weeklyList = ref<any[]>([]);
  const weeklyPager = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const weeklyDialogVisible = ref(false);
  const weeklyViewMode = ref(false);
  const savingWeekly = ref(false);
  const weeklyForm = reactive<any>({ id: null, weekStart: '', plan: '', content: '', attachments: [] });

  // ③ 工作日志列表
  const data = ref<any>({ total: 0, items: [] });
  const selected = ref<any[]>([]);
  const totalPages = computed(() => Math.max(1, Math.ceil(data.value.total / q.pageSize)));
  const users = ref<any[]>([]);
  const customerOpts = ref<any[]>([]);
  const projectOpts = ref<any[]>([]);

  // ④⑤ 客户/项目变更表
  const customerPager = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const projectPager = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const changedCustomersItems = computed<any[]>(() => data.value.changedCustomers?.items || []);
  const changedProjectsItems = computed<any[]>(() => data.value.changedProjects?.items || []);

  // 当前用户
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  // 人员下拉框可见性：admin + leader 可见；其他角色不显示且强制只看自己
  const canViewOwnerFilter = computed(
    () => !!currentUser.isAdmin || (currentUser.roleCodes || []).includes('leader'),
  );

  function fmtDate(d: any) {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
  }
  function startOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  function weekRangeText(weekStart: any) {
    if (!weekStart) return '-';
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${fmtDate(start)} ~ ${fmtDate(end)}`;
  }
  function fmt(d: string) {
    if (!d) return '-';
    return new Date(d).toISOString().slice(0, 10);
  }
  function typeTag(type: string) {
    switch (type) {
      case '客户更新': return 'warning';
      case '项目更新': return 'success';
      case '客户跟进': return 'primary';
      case '项目跟进': return 'primary';
      default: return 'info';
    }
  }

  // ===== 筛选条件变化：联动 4 个模块 =====
  function applyFilters() {
    q.page = 1;
    weeklyPager.page = 1;
    customerPager.page = 1;
    projectPager.page = 1;
    loadWeeklyPage(1);
    load();
  }
  function onDate(v: any) {
    q.dateStart = v?.[0] || '';
    q.dateEnd = v?.[1] || '';
    applyFilters();
  }
  function reset() {
    Object.assign(q, {
      keyword: '',
      ownerId: '',
      customerId: '',
      projectId: '',
      dateStart: '',
      dateEnd: '',
      page: 1,
      pageSize: 10,
    });
    dateRange.value = [];
    weeklyPager.page = 1;
    customerPager.page = 1;
    projectPager.page = 1;
    loadWeeklyPage(1);
    load();
  }

  // ===== ② 本周工作总结 =====

  async function loadWeeklyPage(p: number) {
    weeklyPager.page = p;
    try {
      const res: any = await worklogApi.weeklySummaryList(weeklyPager.page, weeklyPager.pageSize, {
        keyword: q.keyword,
        ownerId: q.ownerId,
        dateStart: q.dateStart,
        dateEnd: q.dateEnd,
      });
      weeklyList.value = res.items || [];
      weeklyPager.total = res.total || 0;
      weeklyPager.totalPages = Math.max(1, Math.ceil(weeklyPager.total / weeklyPager.pageSize));
    } catch {
      /* 拦截器已处理 */
    }
  }
  function onWeeklyPageSize() {
    loadWeeklyPage(1);
  }
  function openWeeklyDialog(row: any) {
    weeklyViewMode.value = false;
    weeklyForm.id = row?.id || null;
    weeklyForm.weekStart = fmtDate(row?.weekStart) || fmtDate(startOfWeek(new Date()));
    weeklyForm.plan = row?.plan || '';
    weeklyForm.content = row?.content || '';
    weeklyForm.attachments = Array.isArray(row?.attachments) ? [...row.attachments] : [];
    weeklyDialogVisible.value = true;
  }
  function viewWeeklyDialog(row: any) {
    openWeeklyDialog(row);
    weeklyViewMode.value = true;
  }
  async function saveWeekly() {
    savingWeekly.value = true;
    try {
      await worklogApi.weeklySummarySave({
        weekStart: weeklyForm.weekStart,
        plan: weeklyForm.plan,
        content: weeklyForm.content,
        attachments: weeklyForm.attachments,
      });
      ElMessage.success('本周总结已保存');
      weeklyDialogVisible.value = false;
      await loadWeeklyPage(weeklyPager.page);
    } finally {
      savingWeekly.value = false;
    }
  }
  async function deleteWeekly(row: any) {
    await ElMessageBox.confirm(`确认删除「${weekRangeText(row.weekStart)}」的本周总结？`, '提示', { type: 'warning' });
    await worklogApi.weeklySummaryDelete(fmtDate(row.weekStart));
    ElMessage.success('已删除');
    await loadWeeklyPage(weeklyPager.page);
  }
  // 只能删除自己的本周总结（其他人的没有 ownerId=self 的写入权限）
  function canEditWeekly(row: any) {
    if (!row.id) return false;
    return !row.ownerId || row.ownerId === currentUser.id;
  }

  // ===== ③ 工作日志列表 =====
  async function load() {
    const res: any = await worklogApi.list({
      ...q,
      customerPage: customerPager.page,
      customerPageSize: customerPager.pageSize,
      projectPage: projectPager.page,
      projectPageSize: projectPager.pageSize,
    });
    data.value = res?.data ?? res;
    customerPager.total = res.changedCustomers?.total || 0;
    customerPager.totalPages = Math.max(1, Math.ceil(customerPager.total / customerPager.pageSize));
    projectPager.total = res.changedProjects?.total || 0;
    projectPager.totalPages = Math.max(1, Math.ceil(projectPager.total / projectPager.pageSize));
  }
  function loadCustomerPage(p: number) {
    customerPager.page = p;
    load();
  }
  function loadProjectPage(p: number) {
    projectPager.page = p;
    load();
  }
  function onCustomerPageSize() {
    loadCustomerPage(1);
  }
  function onProjectPageSize() {
    loadProjectPage(1);
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

  // 问题5：查看/编辑时保存查询状态到sessionStorage
  function snapshotQuery() {
    sessionStorage.setItem(
      'worklogQuery',
      JSON.stringify({
        keyword: q.keyword,
        ownerId: q.ownerId,
        customerId: q.customerId,
        projectId: q.projectId,
        dateStart: q.dateStart,
        dateEnd: q.dateEnd,
        page: q.page,
        pageSize: q.pageSize,
        customerPage: customerPager.page,
        customerPageSize: customerPager.pageSize,
        projectPage: projectPager.page,
        projectPageSize: projectPager.pageSize,
        weeklyPage: weeklyPager.page,
        weeklyPageSize: weeklyPager.pageSize,
      }),
    );
  }
  function goView(id: number, mode?: string) {
    snapshotQuery();
    const query: any = mode ? { mode } : {};
    router.push({ path: `/sales/worklog/${id}`, query });
  }
  function goCustomer(id: number, type?: string) {
    snapshotQuery();
    if (type === 'detail') {
      router.push(`/sales/customer/${id}/detail`);
    } else {
      router.push(`/sales/customer/${id}`);
    }
  }
  function goProject(id: number, mode?: string) {
    snapshotQuery();
    if (mode) {
      router.push(`/sales/project/${id}?mode=${mode}`);
    } else {
      router.push(`/sales/project/${id}`);
    }
  }
  async function searchCustomer(kw: string) {
    if (!kw) return;
    customerOpts.value = await worklogApi.searchCustomer(kw);
  }
  async function searchProject(kw: string) {
    if (!kw) return;
    projectOpts.value = await worklogApi.searchProject(kw);
  }
  // 问题18：导出按当前表格显示列（用户配置）走
  function downloadCsvFromConfig(filename: string, rows: any[], expCols: any[] | undefined, getters: Record<string, (row: any) => any>) {
    const cols = expCols || [];
    const header = cols.map((c: any) => c.label);
    const lines = [header.join(',')];
    rows.forEach((r: any) =>
      lines.push(
        cols
          .map((c: any) => getters[c.key]?.(r) ?? '')
          .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    );
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  async function onExport(cmd: string) {
    const ids = cmd === 'selected' ? selected.value.map((r) => r.id) : [];
    const res: any = await worklogApi.list({
      ...q,
      page: 1,
      pageSize: 99999,
      customerPage: 1,
      customerPageSize: 99999,
      projectPage: 1,
      projectPageSize: 99999,
    });

    // 1. 工作日志
    const logRows = ids.length ? res.items.filter((r: any) => ids.includes(r.id)) : res.items;
    const logGetters: Record<string, (r: any) => any> = {
      code: (r) => r.code || (r.isVirtual ? '—' : '-'),
      type: (r) => r.type || '日志',
      owner: (r) => r.owner?.name || r.ownerName || '',
      date: (r) => fmt(r.date),
      customer: (r) => (r.customer ? `${r.customer.name}(${r.customer.code})` : ''),
      project: (r) => (r.project ? `${r.project.name}(${r.project.code})` : ''),
      content: (r) => (r.content || '').slice(0, 60),
      duration: (r) => r.duration ?? '',
    };
    downloadCsvFromConfig('工作日志.csv', logRows, logTableRef.value?.getExportColumns?.(), logGetters);

    // 2. 客户信息变更
    const custRows = res.changedCustomers?.items || [];
    const custGetters: Record<string, (r: any) => any> = {
      code: (r) => r.code,
      owner: (r) => r.owner?.name || '',
      name: (r) => r.name,
      contactName: (r) => r.contactName || '',
      contactPhone: (r) => r.contacts?.[0]?.mobile || r.contacts?.[0]?.officePhone || '',
      followStage: (r) => r.followStage,
      createdAt: (r) => fmt(r.createdAt),
      inheritDate: (r) => fmt(r.inheritDate),
      status: (r) => (r.submitStatus === 'draft' ? '草稿' : '正式'),
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
    downloadCsvFromConfig('客户信息变更.csv', custRows, custTableRef.value?.getExportColumns?.(), custGetters);

    // 3. 项目信息变更
    const projRows = res.changedProjects?.items || [];
    const projGetters: Record<string, (r: any) => any> = {
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
    };
    downloadCsvFromConfig('项目信息变更.csv', projRows, projTableRef.value?.getExportColumns?.(), projGetters);
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`确认删除日志「${row.code}」？`, '提示', { type: 'warning' });
    await worklogApi.remove(row.id);
    ElMessage.success('已删除');
    load();
  }

  onMounted(async () => {
    if (canViewOwnerFilter.value) {
      users.value = await sysApi.users();
    }

    // 从sessionStorage恢复查询条件
    const savedQuery = sessionStorage.getItem('worklogQuery');
    if (savedQuery) {
      try {
        const saved = JSON.parse(savedQuery);
        Object.assign(q, saved);
        customerPager.page = saved.customerPage || 1;
        customerPager.pageSize = saved.customerPageSize || 10;
        projectPager.page = saved.projectPage || 1;
        projectPager.pageSize = saved.projectPageSize || 10;
        weeklyPager.page = saved.weeklyPage || 1;
        weeklyPager.pageSize = saved.weeklyPageSize || 10;
        if (saved.dateStart && saved.dateEnd) {
          dateRange.value = [saved.dateStart, saved.dateEnd];
        }
        sessionStorage.removeItem('worklogQuery');
      } catch {}
    }

    await loadWeeklyPage(weeklyPager.page);
    await load();
  });
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
</style>