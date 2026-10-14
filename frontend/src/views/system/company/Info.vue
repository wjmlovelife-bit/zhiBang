<template>
  <div>
    <el-card>
      <el-page-header @back="$router.push('/dashboard')" content="公司信息" />
      <el-divider />
      <el-form :model="form" label-width="110px" style="max-width: 720px" v-loading="loading">
        <el-form-item label="公司名称" required>
          <el-input v-model="form.name" placeholder="请输入公司名称" />
        </el-form-item>
        <el-form-item label="公司简称">
          <el-input v-model="form.shortName" placeholder="选填" />
        </el-form-item>
        <el-form-item label="开户行">
          <el-input v-model="form.bankName" placeholder="选填" />
        </el-form-item>
        <el-form-item label="账号">
          <el-input v-model="form.account" placeholder="选填" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="税号">
          <el-input v-model="form.taxNo" placeholder="选填" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="选填" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="form.website" placeholder="选填" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
        <el-form-item label="公司 Logo">
          <el-upload
            :action="uploadUrl"
            :headers="uploadHeaders"
            :show-file-list="false"
            accept="image/*"
            :on-success="onLogoSuccess"
            :before-upload="beforeLogo"
          >
            <el-button type="primary">上传 Logo 图片</el-button>
            <template #tip>
              <div style="color: #999; font-size: 12px">支持 png/jpg 等图片，单文件 ≤ 20MB</div>
            </template>
          </el-upload>
          <div v-if="form.logoUrl" style="margin-top: 10px">
            <img :src="form.logoUrl" alt="logo" style="max-height: 80px; border: 1px solid #eee; padding: 4px" />
            <el-button link type="danger" size="small" style="margin-left: 10px" @click="form.logoUrl = ''">移除</el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="选填" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { sysApi } from '@/api';

const loading = ref(false);
const saving = ref(false);
const uploadUrl = '/api/upload';
const token = localStorage.getItem('token') || '';
const uploadHeaders = { Authorization: `Bearer ${token}` };

const empty = () => ({
  name: '',
  shortName: '',
  bankName: '',
  account: '',
  phone: '',
  taxNo: '',
  email: '',
  website: '',
  address: '',
  logoUrl: '',
  remark: '',
});
const form = reactive(empty());

function beforeLogo(file: any) {
  const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'].includes(file.type);
  if (!ok) ElMessage.error('请上传图片文件');
  return ok;
}
function onLogoSuccess(res: any) {
  if (!res || !res.url) return ElMessage.error('上传失败');
  form.logoUrl = res.url;
  ElMessage.success('Logo 已上传');
}

async function load() {
  loading.value = true;
  try {
    const c: any = await sysApi.company();
    Object.assign(form, empty(), c || {});
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('请填写公司名称');
  saving.value = true;
  try {
    await sysApi.companyUpdate({ ...form });
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
