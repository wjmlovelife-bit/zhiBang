<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="`客户详情 - ${detail.name || ''}`" style="margin-bottom: 16px" />
      <el-tag v-if="detail.submitStatus" :type="detail.submitStatus === 'draft' ? 'warning' : 'success'" style="margin-bottom: 12px">
        {{ detail.submitStatus === 'draft' ? '草稿' : '正式' }}
      </el-tag>

      <!-- 基本信息（按 Form.vue 字段顺序） -->
      <el-divider content-position="left">基本信息</el-divider>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="客户编号">{{ detail.code }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="拼音">{{ detail.pinyin }}</el-descriptions-item>
        <el-descriptions-item label="客户类型">{{ detail.type }}</el-descriptions-item>
        <el-descriptions-item label="客户分类">{{ detail.category }}</el-descriptions-item>
        <el-descriptions-item label="跟进程度">{{ detail.followStage }}</el-descriptions-item>
        <el-descriptions-item label="客户来源">{{ detail.source }}</el-descriptions-item>
        <el-descriptions-item label="客户区域">{{ regionText }}</el-descriptions-item>
        <el-descriptions-item label="客户行业">{{ detail.industry }}</el-descriptions-item>
        <el-descriptions-item label="价值评估">{{ detail.valueRating }}</el-descriptions-item>
        <el-descriptions-item label="信用等级">{{ detail.creditLevel }}</el-descriptions-item>
        <el-descriptions-item label="客户币种">{{ detail.currencyCode }}</el-descriptions-item>
        <el-descriptions-item label="到款限制%">{{ detail.paymentLimitPct }}</el-descriptions-item>
        <el-descriptions-item label="法人代表">{{ detail.legalPerson }}</el-descriptions-item>
        <el-descriptions-item label="注册资本">{{ detail.registeredCapital }}</el-descriptions-item>
        <el-descriptions-item label="园区">{{ detail.park }}</el-descriptions-item>
        <el-descriptions-item label="邮编">{{ detail.zipcode }}</el-descriptions-item>
        <el-descriptions-item label="负责销售人">{{ detail.owner?.name }}</el-descriptions-item>
        <el-descriptions-item label="客户地址" :span="3">{{ detail.address }}</el-descriptions-item>
      </el-descriptions>

      <!-- 业务信息（问题20 新增） -->
      <el-divider content-position="left">业务信息</el-divider>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="客户简介">
          <div style="white-space: pre-wrap">{{ detail.intro || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="合作现状">
          <div style="white-space: pre-wrap">{{ detail.cooperationStatus || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="合作前景">
          <div style="white-space: pre-wrap">{{ detail.prospect || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="跟进策略">
          <div style="white-space: pre-wrap">{{ detail.strategy || '-' }}</div>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 财务信息（问题20 新增） -->
      <el-divider content-position="left">财务信息</el-divider>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="开户银行">{{ detail.bankName }}</el-descriptions-item>
        <el-descriptions-item label="开户名称">{{ detail.accountName }}</el-descriptions-item>
        <el-descriptions-item label="银行账号">{{ detail.bankAccount }}</el-descriptions-item>
        <el-descriptions-item label="银行行号">{{ detail.bankCode }}</el-descriptions-item>
        <el-descriptions-item label="税号">{{ detail.taxId }}</el-descriptions-item>
        <el-descriptions-item label="账期(天)">{{ detail.paymentDays }}</el-descriptions-item>
        <el-descriptions-item label="银行地址" :span="2">{{ detail.bankAddress }}</el-descriptions-item>
        <el-descriptions-item label="银行电话">{{ detail.bankPhone }}</el-descriptions-item>
        <el-descriptions-item label="结算日期(每月几号)">{{ detail.settleDay }}</el-descriptions-item>
      </el-descriptions>

      <!-- 备注 + 附件（问题20 新增） -->
      <el-divider content-position="left">备注</el-divider>
      <div style="margin-bottom: 16px; white-space: pre-wrap">{{ detail.remark || '-' }}</div>
      <AttachmentList :list="detail.attachments || []" />

      <!-- 联系人 -->
      <el-divider content-position="left">联系人</el-divider>
      <el-table :data="detail.contacts || []" border>
        <el-table-column label="姓名" prop="name" />
        <el-table-column label="性别" prop="gender" width="80" />
        <el-table-column label="部门" prop="department" />
        <el-table-column label="职务" prop="position" />
        <el-table-column label="手机" prop="mobile" />
        <el-table-column label="办公电话" prop="officePhone" />
        <el-table-column label="传真" prop="fax" />
        <el-table-column label="微信" prop="wechat" />
      </el-table>

      <!-- 跟进记录 -->
      <el-divider content-position="left">跟进记录</el-divider>
      <FollowEditor v-model="followList" :page-size="10" :contact-options="contactOptions" />

      <!-- 继承历史 -->
      <el-divider content-position="left">继承历史</el-divider>
      <el-table :data="detail.inherits || []" border>
        <el-table-column label="原负责人" width="120"><template #default="{ row }">{{ row.fromUser?.name || row.fromUserId }}</template></el-table-column>
        <el-table-column label="接收人" width="120"><template #default="{ row }">{{ row.toUser?.name || row.toUserId }}</template></el-table-column>
        <el-table-column label="继承时间" width="160"><template #default="{ row }">{{ fmt(row.inheritedAt) }}</template></el-table-column>
        <el-table-column label="原因"><template #default="{ row }">{{ row.reason }}</template></el-table-column>
      </el-table>

    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { customerApi, followApi, sysApi } from '@/api';
import { useUserStore } from '@/store/user';
import AttachmentList from '@/components/AttachmentList.vue';
import FollowEditor, { FollowRow, ContactOption } from '@/components/FollowEditor.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const id = Number(route.params.id);
const detail = ref<any>({});
const followList = ref<FollowRow[]>([]);
const contactOptions = ref<ContactOption[]>([]);

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

// 客户区域（省/市/区）拼接显示：labels 有就用 labels，否则从 ID 查 map
// 兼容 DB 里 region 为空数组但 stateId/cityId/districtId 已存的旧数据
const regionText = computed(() => {
  const d = detail.value;
  const labels = Array.isArray(d.region) ? d.region.filter(Boolean) : [];
  if (labels.length) return labels.join(' / ');
  const ids = [d.stateId, d.cityId, d.districtId].filter((x) => x != null);
  if (ids.length) {
    const names = ids.map((id) => regionMap.value.get(id)).filter(Boolean);
    if (names.length) return names.join(' / ');
  }
  return '-';
});

// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/sales/customer');
  }
}

function fmt(d: string) {
  return d ? new Date(d).toISOString().slice(0, 10) : '-';
}
async function load() {
  detail.value = await customerApi.detail(id);
  followList.value = (detail.value.follows || []).map((f: any, idx: number) => ({
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

function splitContactName(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(';').map((s) => s.trim()).filter(Boolean);
  return [];
}

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
onMounted(async () => {
  await load();
  // 拉省/市/区 ID→name 映射（用于 region 字段为空时回退显示）
  await loadRegionMap();
});
</script>