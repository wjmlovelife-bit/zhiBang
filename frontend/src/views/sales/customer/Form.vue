<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isEdit ? '编辑客户' : '新建客户'" style="margin-bottom: 16px" />
      <el-form :model="form" :rules="rules" ref="fref" label-width="110px">
        <el-divider content-position="left">基本情况</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="客户名称" prop="name"><el-input v-model="form.name" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="拼音"><el-input v-model="form.pinyin" placeholder="自动生成可留空" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户编号"><el-input v-model="form.code" :placeholder="codePlaceholder" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="客户类型">
              <el-select v-model="form.type" style="width: 100%">
                <el-option label="单位客户" value="单位客户" /><el-option label="个人客户" value="个人客户" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户分类" prop="category">
              <el-select v-model="form.category" style="width: 100%">
                <el-option v-for="o in opt.category" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="跟进程度" prop="followStage">
              <el-select v-model="form.followStage" style="width: 100%">
                <el-option v-for="o in opt.followStage" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="客户来源">
              <el-select v-model="form.source" style="width: 100%">
                <el-option v-for="o in opt.source" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户区域" prop="stateId">
              <el-cascader v-model="region" :options="regionOptions" :props="{ value: 'value', label: 'label', children: 'children' }" @change="onRegion" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户行业" prop="industry">
              <el-select v-model="form.industry" style="width: 100%">
                <el-option v-for="o in opt.industry" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="价值评估">
              <el-select v-model="form.valueRating" style="width: 100%">
                <el-option v-for="o in opt.valueRating" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="信用等级">
              <el-select v-model="form.creditLevel" style="width: 100%">
                <el-option v-for="o in opt.credit" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户币种">
              <el-select v-model="form.currencyCode" style="width: 100%">
                <el-option v-for="o in opt.currency" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="到款限制%"><el-input v-model="form.paymentLimitPct" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="客户地址"><el-input v-model="form.address" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="邮编"><el-input v-model="form.zipcode" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="法人代表"><el-input v-model="form.legalPerson" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="注册资本"><el-input v-model="form.registeredCapital" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="园区"><el-input v-model="form.park" /></el-form-item></el-col>
        </el-row>

        <el-divider content-position="left">联系信息</el-divider>
        <el-button size="small" @click="addContact">+ 添加联系人</el-button>
        <el-table :data="form.contacts" border style="margin-top: 10px">
          <el-table-column label="姓名" width="120"><template #default="{ row }"><el-input v-model="row.name" /></template></el-table-column>
          <el-table-column label="性别" width="90"><template #default="{ row }"><el-select v-model="row.gender"><el-option label="男" value="男" /><el-option label="女" value="女" /></el-select></template></el-table-column>
          <el-table-column label="部门"><template #default="{ row }"><el-input v-model="row.department" /></template></el-table-column>
          <el-table-column label="职务"><template #default="{ row }"><el-input v-model="row.position" /></template></el-table-column>
          <el-table-column label="手机"><template #default="{ row }"><el-input v-model="row.mobile" /></template></el-table-column>
          <el-table-column label="办公电话"><template #default="{ row }"><el-input v-model="row.officePhone" /></template></el-table-column>
          <el-table-column label="传真"><template #default="{ row }"><el-input v-model="row.fax" /></template></el-table-column>
          <el-table-column label="微信"><template #default="{ row }"><el-input v-model="row.wechat" /></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{ $index }"><el-button v-if="isAdmin" link type="danger" @click="form.contacts.splice($index, 1)">删</el-button></template></el-table-column>
        </el-table>

        <el-divider content-position="left">业务信息</el-divider>
        <el-form-item label="客户简介"><el-input v-model="form.intro" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="合作现状"><el-input v-model="form.cooperationStatus" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="合作前景"><el-input v-model="form.prospect" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="跟进策略"><el-input v-model="form.strategy" type="textarea" :rows="2" /></el-form-item>

        <el-divider content-position="left">财务信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="开户银行"><el-input v-model="form.bankName" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="开户名称"><el-input v-model="form.accountName" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="银行账号"><el-input v-model="form.bankAccount" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="银行行号"><el-input v-model="form.bankCode" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="税号"><el-input v-model="form.taxId" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="账期(天)"><el-input v-model="form.paymentDays" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="银行地址"><el-input v-model="form.bankAddress" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="银行电话"><el-input v-model="form.bankPhone" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="结算日期(每月几号)"><el-input v-model="form.settleDay" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注（可上传图片/文件）">
          <el-input v-model="form.remark" type="textarea" :rows="6" placeholder="可容纳千字，并支持上传图片、文件" />
          <AttachmentUploader v-model="form.attachments" />
        </el-form-item>

        <el-divider content-position="left">跟进记录</el-divider>
        <FollowEditor
          v-model="followRows"
          editable
          :page-size="10"
          :default-follower-name="userStore.user.name"
          :contact-options="contactOptions"
        />

        <div style="margin-top: 20px; text-align: right">
          <el-button @click="goBack">返回</el-button>
          <el-button @click="save('draft')">保存为草稿</el-button>
          <el-button type="primary" @click="save('active')">确认</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { customerApi, sysApi, followApi } from '@/api';
import { useUserStore } from '@/store/user';
import AttachmentUploader from '@/components/AttachmentUploader.vue';
import FollowEditor, { FollowRow, ContactOption } from '@/components/FollowEditor.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const isEdit = computed(() => !!route.params.id);
const isAdmin = computed(() => userStore.dataScope === 1);
const id = Number(route.params.id);
const codePlaceholder = ref('');
const region = ref<any[]>([]);
const regionOptions = ref<any[]>([]);
// 跟进记录：历史 + 待新增 统一管理
const followRows = ref<FollowRow[]>([]);
const contactOptions = ref<ContactOption[]>([]);
const fref = ref<any>();

const opt = {
  category: ['终端公司', '分销', '集成商', '招标公司'],
  followStage: ['初期沟通', '跟进中', '商务谈判', '已成交', '已流失'],
  source: ['电话咨询', '客户介绍', '独立开发', '展会活动', '公司分派'],
  industry: ['国防军工', '科研院所', '检测机构', '大专院校', '分销渠道', '电子制造', '芯片制造', '汽车电子', '石油化工', '能源电力', '其他行业'],
  valueRating: ['高', '中', '低'],
  credit: ['AAA', 'AA', 'A', 'B', 'C'],
  currency: ['人民币', '美元', '欧元', '日元', '英镑', '港币', '其他'],
};

const blank = () => ({
  name: '', pinyin: '', code: '', type: '单位客户', category: '', followStage: '', source: '',
  industry: '', valueRating: '', creditLevel: '', currencyCode: '人民币',
  region: [], stateId: null, cityId: null, districtId: null, address: '', zipcode: '',
  legalPerson: '', registeredCapital: '', park: '', paymentLimitPct: '',
  contacts: [] as any[], intro: '', cooperationStatus: '', prospect: '', strategy: '',
  bankName: '', accountName: '', bankAccount: '', bankCode: '', taxId: '', paymentDays: '', remark: '', attachments: [],
  submitStatus: 'draft',
});

const form = reactive(blank());
const rules = {
  name: [{ required: true, message: '必填', trigger: 'blur' }],
  category: [{ required: true, message: '必填', trigger: 'change' }],
  followStage: [{ required: true, message: '必填', trigger: 'change' }],
  industry: [{ required: true, message: '必填', trigger: 'change' }],
  stateId: [{ required: true, type: 'number', message: '请选择客户区域', trigger: 'change' }],
};

function addContact() {
  form.contacts.push({ name: '', gender: '男', department: '', position: '', mobile: '', wechat: '' });
}
function onRegion(val: any[], selected: any[]) {
  form.stateId = val?.[0] ?? null;
  form.cityId = val?.[1] ?? null;
  form.districtId = val?.[2] ?? null;
  form.region = (selected || []).map((s) => s.label).filter(Boolean);
}

/** 把数据库字符串 "张三;李四" 拆成数组；已是数组则原样返回 */
function splitContactName(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(';').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** 把后端 contacts 扁平化为 el-select 选项 */
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
  const d: any = await customerApi.detail(id);
  Object.assign(form, d, { contacts: d.contacts || [], attachments: d.attachments || [] });
  region.value = [d.stateId, d.cityId, d.districtId].filter((x: any) => x != null);
  // 把后端返回的 follows 映射成统一行（含 _localId / _isNew=false 标记）
  followRows.value = (d.follows || []).map((f: any, idx: number) => ({
    _localId: -(idx + 1), // 历史行用负 id，避免和新增行（正 id）冲突
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
  const d: any = await customerApi.detail(id);
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
    router.replace('/sales/customer');
  }
}

// 必填字段 prop -> 中文标签（与 rules 一一对应）
const REQUIRED_FIELDS: Record<string, string> = {
  name: '客户名称',
  category: '客户分类',
  followStage: '跟进程度',
  industry: '客户行业',
  stateId: '客户区域',
};

async function save(status: string) {
  // 点"确认"时先做必填校验：未填齐则弹窗列出所有缺失字段
  if (status === 'draft' || status === 'active') {
    try {
      await fref.value?.validate();
    } catch (errs: any) {
      const missing = Object.keys(errs || {})
        .map((k) => REQUIRED_FIELDS[k] || k)
        .filter(Boolean);
      await ElMessageBox.alert(
        `请填写以下必填字段后再确认：\n${missing.join('、')}`,
        '必填字段未填',
        { type: 'warning', confirmButtonText: '我知道了', dangerouslyUseHTMLString: false },
      );
      return;
    }
  }

  form.submitStatus = status;
  const payload: any = { ...form };
  if (status === 'active' && !form.code) payload.code = codePlaceholder.value || undefined;
  try {
    let targetId = id;
    if (isEdit.value) await customerApi.update(id, payload);
    else {
      const r: any = await customerApi.create(payload);
      targetId = r.id;
    }

    // 跟进记录：保存删除 / 修改 / 新增（仅在编辑模式下处理；新建客户本次不持久化跟进，留作下一轮）
    if (isEdit.value) {
      const rows = followRows.value;
      const toDelete = rows.filter((r) => !r._isNew && r._deleted && r.id);
      const toUpdate = rows.filter((r) => !r._isNew && r._modified && !r._deleted && r.id);
      const toCreate = rows.filter((r) => r._isNew && !r._deleted);

      // 1. 删除
      for (const r of toDelete) {
        await customerApi.deleteFollow(targetId, r.id!);
      }
      // 2. 修改
      for (const r of toUpdate) {
        await customerApi.updateFollow(targetId, r.id!, {
          followDate: r.followDate,
          period: r.period,
          schedule: r.schedule,
          contactName: r.contactNames ?? [],
          content: r.content ?? '',
        });
      }
      // 3. 新增
      for (const r of toCreate) {
        await customerApi.addFollow(targetId, {
          followerId: r.followerId,
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
      router.push('/sales/customer');
    }
    // 编辑"确认"场景保留在当前页（用户决策）
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(async () => {
  codePlaceholder.value = (await customerApi.nextCode()) || '';
  if (isEdit.value) await loadDetail();
  else await loadContactOptions(); // 新建页也能用联系人下拉
  // 区域选项（省/市/区三级完整树，供 cascader 级联）
  regionOptions.value = (await sysApi.regionsTree()) || [];
});
</script>
