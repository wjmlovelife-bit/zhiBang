<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isView ? '查看日志' : (isEdit ? '编辑日志' : '新建日志')" />
      <el-divider />
      <el-form :model="form" label-width="100px" style="max-width: 860px" :disabled="isView">
        <el-form-item label="日志编号">
          <el-input :value="code" disabled placeholder="保存后生成" />
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 220px" />
        </el-form-item>
        <el-form-item label="填写人">
          <el-input :value="ownerName" disabled />
        </el-form-item>
        <el-form-item label="关联客户">
          <el-select
            v-model="form.customerId"
            clearable
            filterable
            remote
            placeholder="输入客户名/编号搜索"
            :remote-method="searchCustomer"
            style="width: 100%"
          >
            <el-option v-for="c in customerOpts" :key="c.id" :label="`${c.name}(${c.code})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联项目">
          <el-select
            v-model="form.projectId"
            clearable
            filterable
            remote
            placeholder="输入项目主题/编号搜索"
            :remote-method="searchProject"
            style="width: 100%"
          >
            <el-option v-for="p in projectOpts" :key="p.id" :label="`${p.name}(${p.code})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="8" placeholder="填写工作内容" />
        </el-form-item>
        <el-form-item label="耗时(h)">
          <el-input-number v-model="form.duration" :min="0" :precision="1" :step="0.5" style="width: 180px" />
        </el-form-item>
        <el-form-item label="附件">
          <AttachmentUploader v-model="form.attachments" :disabled="isView" />
        </el-form-item>
      </el-form>
      <div style="margin-top: 8px">
        <el-button v-if="!isView" type="primary" :loading="saving" @click="save">保存</el-button>
        <el-button @click="goBack">返回</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { worklogApi } from '@/api';
import { useUserStore } from '@/store/user';
import AttachmentUploader from '@/components/AttachmentUploader.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const isEdit = computed(() => !!route.params.id);
const id = Number(route.params.id);
const isView = computed(() => route.query.mode === 'view');

const code = ref('');
const ownerName = computed(() => userStore.user?.name || '');

const form = reactive({
  date: '',
  ownerId: userStore.user?.id,
  customerId: undefined as number | undefined,
  projectId: undefined as number | undefined,
  content: '',
  duration: undefined as number | undefined,
  attachments: [] as any[],
});

const customerOpts = ref<any[]>([]);
const projectOpts = ref<any[]>([]);
const saving = ref(false);

async function searchCustomer(kw: string) {
  if (!kw) return;
  customerOpts.value = await worklogApi.searchCustomer(kw);
}
async function searchProject(kw: string) {
  if (!kw) return;
  projectOpts.value = await worklogApi.searchProject(kw);
}

// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/sales/worklog');
  }
}

async function save() {
  if (!form.date) return ElMessage.warning('请选择日期');
  if (!form.content.trim()) return ElMessage.warning('请填写内容');
  const payload: any = {
    date: form.date,
    ownerId: form.ownerId,
    content: form.content,
    customerId: form.customerId || null,
    projectId: form.projectId || null,
    duration: form.duration ?? null,
    attachments: form.attachments,
  };
  saving.value = true;
  try {
    if (isEdit.value) {
      await worklogApi.update(id, payload);
      ElMessage.success('已保存');
    } else {
      const r: any = await worklogApi.create(payload);
      code.value = r.code;
      ElMessage.success('已保存');
    }
    router.push('/sales/worklog');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  if (isEdit.value) {
    const d: any = await worklogApi.detail(id);
    code.value = d.code;
    form.date = (d.date || '').slice(0, 10);
    form.ownerId = d.ownerId;
    form.content = d.content || '';
    form.duration = d.duration ?? undefined;
    form.attachments = Array.isArray(d.attachments) ? d.attachments : [];
    if (d.customer) {
      form.customerId = d.customer.id;
      customerOpts.value = [{ id: d.customer.id, code: d.customer.code, name: d.customer.name }];
    }
    if (d.project) {
      form.projectId = d.project.id;
      projectOpts.value = [{ id: d.project.id, code: d.project.code, name: d.project.name }];
    }
  } else {
    code.value = await worklogApi.nextCode();
  }
});
</script>
