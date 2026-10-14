<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isView ? '查看项目' : (isEdit ? '编辑项目' : '新建项目')" style="margin-bottom: 16px" />
      <el-form :model="form" :rules="rules" ref="fref" label-width="110px" :disabled="isView">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="项目编号"><el-input v-model="form.code" :placeholder="codePlaceholder" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户编号" prop="customerCode">
              <el-select
                v-model="form.customerCode"
                filterable
                remote
                :remote-method="searchCustomer"
                @change="onCustomerPick"
                placeholder="输入客户名/编号搜索"
                style="width: 100%"
              >
                <el-option v-for="c in customerOpts" :key="c.id" :label="`${c.code} ${c.name}`" :value="c.code" />
              </el-select>
              <div v-if="customerInfo" style="margin-top: 6px; color: #666; font-size: 12px">
                关联客户：{{ customerInfo.name }} ｜ 负责人：{{ customerInfo.ownerName || '-' }} ｜ 地址：{{ customerInfo.address || '-' }}
                <el-button link type="danger" size="small" @click="clearCustomer">去创建/清除</el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="项目主题" prop="name"><el-input v-model="form.name" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责销售人" prop="ownerId">
              <el-select v-model="form.ownerId" filterable style="width: 100%">
                <el-option v-for="u in users" :key="u.id" :label="`${u.name}(${u.username})`" :value="u.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="发现日期" prop="dateOpen"><el-date-picker v-model="form.dateOpen" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="项目地区">
              <el-cascader v-if="!isView" v-model="region" :options="regionOptions" :props="{ value: 'value', label: 'label', children: 'children' }" @change="onRegion" style="width:100%" />
              <div v-else style="padding: 6px 0; color: #303133">{{ regionDisplay || '-' }}</div>
            </el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="币种"><el-select v-model="form.currencyCode" style="width:100%"><el-option v-for="o in opt.currency" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="项目分类" prop="category"><el-select v-model="form.category" style="width:100%"><el-option v-for="o in opt.category" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="项目阶段" prop="stage"><el-select v-model="form.stage" style="width:100%"><el-option v-for="o in opt.stage" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="项目来源" prop="source"><el-select v-model="form.source" style="width:100%"><el-option v-for="o in opt.source" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="项目状态" prop="state"><el-select v-model="form.state" style="width:100%"><el-option v-for="o in opt.state" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="项目日期"><el-date-picker v-model="form.projectDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="项目总额"><el-input v-model="form.expectedRevenue" @input="calcFinal" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="优惠折扣(折)"><el-input v-model="form.discountPct" @input="calcFinal" placeholder="如9.5" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="优惠后总额"><el-input v-model="form.amountFinal" readonly /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="预计费用"><el-input v-model="form.plannedCost" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="关联合同">
              <el-select v-model="form.contractId" filterable remote :remote-method="searchContract" @change="onContractPick" style="width:100%" placeholder="输入合同关键字">
                <el-option v-for="c in contractOpts" :key="c.id" :label="`${c.code} ${c.title}`" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">项目商品信息</el-divider>
        <el-button size="small" :disabled="isView" @click="addItem">+ 添加商品</el-button>
        <el-table :data="form.items" border style="margin-top: 10px">
          <el-table-column label="产品名称" min-width="140"><template #default="{ row }"><el-input v-model="row.productName" /></template></el-table-column>
          <el-table-column label="编号" width="120"><template #default="{ row }"><el-input v-model="row.productCode" /></template></el-table-column>
          <el-table-column label="型号" width="120"><template #default="{ row }"><el-input v-model="row.model" /></template></el-table-column>
          <el-table-column label="单价" width="110"><template #default="{ row }"><el-input v-model="row.unitPrice" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="数量" width="100"><template #default="{ row }"><el-input v-model="row.quantity" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="总价" width="110"><template #default="{ row }"><el-input v-model="row.amount" readonly /></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{ $index }"><el-button link type="danger" :disabled="isView" @click="form.items.splice($index,1)">删</el-button></template></el-table-column>
        </el-table>
        <div style="margin-top: 8px">
          <el-button @click="previewPdf">预览/下载 PDF</el-button>
        </div>

        <el-divider content-position="left">项目概要</el-divider>
        <el-input v-model="form.description" type="textarea" :rows="3" />
        <div style="margin-top: 8px">
          <el-form-item label="项目附件" label-width="0" style="margin-bottom: 0">
            <AttachmentUploader v-model="form.attachments" :disabled="isView" />
          </el-form-item>
        </div>

        <el-divider content-position="left">跟进记录</el-divider>
        <FollowEditor
          v-model="followRows"
          :editable="!isView"
          :page-size="10"
          :default-follower-name="userStore.user.name"
          :contact-options="contactOptions"
        />

        <el-divider v-if="isView" content-position="left">继承历史</el-divider>
        <el-table v-if="isView" :data="form.inherits || []" border>
          <el-table-column label="原负责人" width="140"><template #default="{ row }">{{ row.fromUser?.name || row.fromUserId }}</template></el-table-column>
          <el-table-column label="接收人" width="140"><template #default="{ row }">{{ row.toUser?.name || row.toUserId }}</template></el-table-column>
          <el-table-column label="继承时间" width="170"><template #default="{ row }">{{ fmt(row.inheritedAt) }}</template></el-table-column>
          <el-table-column label="原因"><template #default="{ row }">{{ row.reason }}</template></el-table-column>
        </el-table>

        <div style="margin-top: 20px; text-align: right">
          <el-button @click="goBack">返回</el-button>
          <template v-if="!isView">
            <el-button @click="save('draft')">保存为草稿</el-button>
            <el-button type="primary" @click="save('active')">确认</el-button>
          </template>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectApi, sysApi, followApi } from '@/api';
import { openPdfPreview } from '@/composables/usePdfPreview';
import { useUserStore } from '@/store/user';
import AttachmentUploader from '@/components/AttachmentUploader.vue';
import FollowEditor, { FollowRow, ContactOption } from '@/components/FollowEditor.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const isEdit = computed(() => !!route.params.id);
const id = Number(route.params.id);
const isView = computed(() => route.query.mode === 'view');
const codePlaceholder = ref('');
const users = ref<any[]>([]);
const region = ref<any[]>([]);
const regionOptions = ref<any[]>([]);
// 省/市/区 ID→name 映射（用于查看态 region 为空时回退显示）
const regionMap = ref<Map<number, string>>(new Map());
function flattenRegions(nodes: any[], map: Map<number, string>) {
  for (const n of nodes || []) {
    map.set(n.value, n.label);
    if (n.children) flattenRegions(n.children, map);
  }
}
async function loadRegionMap() {
  const tree = await sysApi.regionsTree();
  const map = new Map<number, string>();
  flattenRegions(tree, map);
  regionMap.value = map;
}
// 查看态（isView）显示用的纯文本：labels 优先（且非纯数字），否则 ID 查 map
// 关键：loadDetail 里 region.value = [stateId, cityId, districtId] 是 ID 数组，
// 直接 '2661 / 2662 / 2669' 会把 raw ID 显示出来——必须判断全数字时走 form 路径。
const regionDisplay = computed(() => {
  const labels = Array.isArray(region.value) ? region.value.filter(Boolean) : [];
  const looksLikeIds = labels.length > 0 && labels.every((x: any) => /^\d+$/.test(String(x)));
  if (labels.length && !looksLikeIds) return labels.join(' / ');
  const ids = [form.stateId, form.cityId, form.districtId].filter((x) => x != null);
  if (ids.length) {
    const names = ids.map((id) => regionMap.value.get(Number(id))).filter(Boolean);
    if (names.length) return names.join(' / ');
  }
  return '';
});
const customerOpts = ref<any[]>([]);
const contractOpts = ref<any[]>([]);
const customerInfo = ref<any>(null);
// 跟进记录：历史 + 待新增 统一管理（与客户 Form.vue 一致）
const followRows = ref<FollowRow[]>([]);
const contactOptions = ref<ContactOption[]>([]);
const fref = ref<any>();
const me = computed(() => userStore.user.name);

function fmt(d: string) {
  return d ? new Date(d).toISOString().slice(0, 10) : '-';
}

const opt = {
  category: ['系统集成', '电磁兼容', '仪表销售', '仪器租赁', '代客户购', '过单转售'],
  stage: ['初期沟通', '立项评估', '方案制定', '招投标', '商务谈判', '合同签订', '长期合作'],
  source: ['电话咨询', '客户介绍', '独立开发', '展会活动', '公司分派'],
  state: ['成功', '失败', '延误', '跟踪', '初期跟进'],
  currency: ['人民币', '美元', '欧元', '日元', '英镑', '港币', '其他'],
};

const blank = () => ({
  code: '', customerCode: '', customerId: '', name: '', ownerId: userStore.user.id, dateOpen: '',
  region: [], stateId: null, cityId: null, districtId: null, currencyCode: '人民币',
  category: '', stage: '', source: '', state: '', projectDate: '',
  expectedRevenue: '', discountPct: '', amountFinal: '', plannedCost: '',
  contractId: '', description: '', items: [] as any[], attachments: [] as any[], submitStatus: 'draft',
});

const form = reactive(blank());
const rules = {
  name: [{ required: true, message: '必填', trigger: 'blur' }],
  customerCode: [{ required: true, message: '必填', trigger: 'change' }],
  dateOpen: [{ required: true, message: '必填', trigger: 'change' }],
  category: [{ required: true, message: '必填', trigger: 'change' }],
  stage: [{ required: true, message: '必填', trigger: 'change' }],
  source: [{ required: true, message: '必填', trigger: 'change' }],
  state: [{ required: true, message: '必填', trigger: 'change' }],
  ownerId: [{ required: true, message: '必填', trigger: 'change' }],
};

function calcFinal() {
  const rev = parseFloat(form.expectedRevenue) || 0;
  const pct = parseFloat(form.discountPct) || 10;
  form.amountFinal = Math.round(rev * (pct / 10) * 100) / 100;
}
function recalc(row: any) {
  const u = parseFloat(row.unitPrice) || 0;
  const q = parseFloat(row.quantity) || 0;
  row.amount = Math.round(u * q * 100) / 100;
}
function addItem() {
  form.items.push({ productName: '', productCode: '', model: '', unitPrice: '', quantity: '', amount: '' });
}
function onRegion(v: any[], selected: any[]) {
  form.stateId = v?.[0] ?? null;
  form.cityId = v?.[1] ?? null;
  form.districtId = v?.[2] ?? null;
  form.region = (selected || []).map((s) => s.label).filter(Boolean);
}
async function searchCustomer(kw: string) {
  if (!kw) return;
  customerOpts.value = await projectApi.searchCustomer(kw);
}
function onCustomerPick(code: string) {
  const c = customerOpts.value.find((x) => x.code === code);
  if (c) {
    form.customerId = c.id;
    customerInfo.value = { name: c.name, ownerName: c.ownerName, address: c.address };
  }
}
function clearCustomer() {
  form.customerCode = '';
  form.customerId = '';
  customerInfo.value = null;
}
async function searchContract(kw: string) {
  if (!kw) return;
  contractOpts.value = await projectApi.searchContract(kw);
}
function onContractPick() {}

async function previewPdf() {
  if (!isEdit.value) {
    ElMessage.info('请先保存后再预览 PDF');
    return;
  }
  const token = localStorage.getItem('token') || '';
  openPdfPreview(`${projectApi.pdfUrl(id)}?token=${token}`, `项目-${id}.pdf`);
}

/** 把数据库字符串 "张三;李四" 拆成数组；已是数组则原样返回 */
function splitContactName(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(';').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** 拉当前跟进人名下所有客户的所有联系人 */
async function loadContactOptions() {
  const uid = userStore.user?.id;
  if (!uid) { contactOptions.value = []; return; }
  const list: any[] = await followApi.contacts(uid);
  contactOptions.value = list.map((c) => ({
    label: c.customerName
      ? `${c.customerName} / ${c.contactName}` + (c.mobile ? ` (${c.mobile})` : '')
      : c.contactName,
    value: c.contactName,
    contactId: c.contactId,
    customerId: c.customerId,
    customerName: c.customerName,
  }));
}

async function loadDetail() {
  const d: any = await projectApi.detail(id);
  Object.assign(form, d, {
    items: (d.items || []).map(({ id, projectId, createdAt, updatedAt, ...r }: any) => r),
  });
  // 兼容旧数据：attachments 可能是 string（极少数历史情况）
  if (typeof form.attachments === 'string') {
    try { form.attachments = JSON.parse(form.attachments); } catch { form.attachments = []; }
  } else if (!Array.isArray(form.attachments)) {
    form.attachments = [];
  }
  region.value = [d.stateId, d.cityId, d.districtId].filter((x: any) => x != null);
  if (d.customer) {
    customerInfo.value = { name: d.customer.name, ownerName: '', address: '' };
    customerOpts.value = [{ id: d.customer.id, code: d.customer.code, name: d.customer.name }];
  }
  form.inherits = d.inherits || [];
  // 把后端返回的 follows 映射成统一行（含 _localId / _isNew=false 标记）
  followRows.value = (d.follows || []).map((f: any, idx: number) => ({
    _localId: -(idx + 1),
    _isNew: false,
    id: f.id,
    followerId: f.follower?.id,
    followerName: f.follower?.name,
    followDate: f.followDate ? f.followDate.slice(0, 10) : '',
    period: f.period ?? null,
    schedule: f.schedule ?? '',
    contactNames: splitContactName(f.contactName),
    content: f.content || '',
  }));
  await loadContactOptions();
}

/** 跟进区数据重拉（保存成功后调用，保持页面停留但跟进区数据最新） */
async function refreshFollows() {
  const d: any = await projectApi.detail(id);
  followRows.value = (d.follows || []).map((f: any, idx: number) => ({
    _localId: -(idx + 1),
    _isNew: false,
    id: f.id,
    followerId: f.follower?.id,
    followerName: f.follower?.name,
    followDate: f.followDate ? f.followDate.slice(0, 10) : '',
    period: f.period ?? null,
    schedule: f.schedule ?? '',
    contactNames: splitContactName(f.contactName),
    content: f.content || '',
  }));
  await loadContactOptions();
}
// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/sales/project');
  }
}

const REQUIRED_FIELDS: Record<string, string> = {
  name: '项目主题',
  customerCode: '客户编号',
  dateOpen: '发现日期',
  category: '项目分类',
  stage: '项目阶段',
  source: '项目来源',
  state: '项目状态',
  ownerId: '负责销售人',
};

async function save(status: string) {
  form.submitStatus = status;
  // 必填校验：保存为草稿与确认都需校验，缺失则弹窗列出并中断保存
  try {
    await fref.value?.validate();
  } catch (errs: any) {
    const missing = Object.keys(errs || {})
      .map((k) => REQUIRED_FIELDS[k] || k)
      .filter(Boolean);
    await ElMessageBox.alert(
      `请填写以下必填字段后再保存：\n${missing.join('、')}`,
      '必填字段未填',
      { type: 'warning', confirmButtonText: '我知道了', appendToBody: true },
    );
    return;
  }
  const payload: any = { ...form };
  if (!isEdit.value && !form.code) payload.code = codePlaceholder.value || undefined;
  try {
    let targetId = id;
    if (isEdit.value) await projectApi.update(id, payload);
    else {
      const r: any = await projectApi.create(payload);
      targetId = r.id;
    }

    // 跟进记录：保存删除 / 修改 / 新增（仅在编辑模式下处理）
    if (isEdit.value) {
      const rows = followRows.value;
      const toDelete = rows.filter((r) => !r._isNew && r._deleted && r.id);
      const toUpdate = rows.filter((r) => !r._isNew && r._modified && !r._deleted && r.id);
      const toCreate = rows.filter((r) => r._isNew && !r._deleted);

      // 1. 删除
      for (const r of toDelete) {
        await projectApi.deleteFollow(targetId, r.id!);
      }
      // 2. 修改
      for (const r of toUpdate) {
        await projectApi.updateFollow(targetId, r.id!, {
          followDate: r.followDate,
          period: r.period,
          schedule: r.schedule,
          contactName: r.contactNames ?? [],
          content: r.content ?? '',
        });
      }
      // 3. 新增
      for (const r of toCreate) {
        await projectApi.addFollow(targetId, {
          followerId: r.followerId ?? userStore.user.id,
          followDate: r.followDate,
          period: r.period,
          schedule: r.schedule,
          contactName: r.contactNames ?? [],
          content: r.content ?? '',
        });
      }

      // 全部成功 → 留在当前页面，刷新跟进区数据
      await refreshFollows();
    }

    ElMessage.success(status === 'draft' ? '已存草稿' : '已确认');
    if (status === 'draft' || !isEdit.value) {
      // 草稿或新建场景跳回列表
      router.push('/sales/project');
    }
    // 编辑"确认"场景保留在当前页（用户决策）
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(async () => {
  codePlaceholder.value = (await projectApi.nextCode()) || '';
  users.value = await sysApi.users();
  regionOptions.value = (await sysApi.regionsTree()) || [];
  await loadRegionMap();
  if (isEdit.value) await loadDetail();
  else await loadContactOptions(); // 新建页也能用联系人下拉
});
</script>
