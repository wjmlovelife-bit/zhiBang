<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isEdit ? '编辑库存' : '新建库存'" style="margin-bottom: 16px" />
      <el-form :model="form" :rules="rules" ref="fref" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="商品名称" prop="productName">
              <el-input v-model="form.productName" placeholder="如：示波器" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商品型号" prop="productModel">
              <el-input v-model="form.productModel" placeholder="如：DS7054" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="厂家" prop="manufacturer">
              <el-input v-model="form.manufacturer" placeholder="如：RIGOL" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="日期" prop="date">
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注（可上传图片/文件）">
          <el-input v-model="form.remark" type="textarea" :rows="6" placeholder="可容纳千字，并支持上传图片、文件" />
          <AttachmentUploader v-model="form.attachments" />
        </el-form-item>

        <div style="margin-top: 20px; text-align: right">
          <el-button @click="goBack">返回</el-button>
          <el-button type="primary" @click="save">确认</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { inventoryApi } from '@/api';
import AttachmentUploader from '@/components/AttachmentUploader.vue';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const id = Number(route.params.id);
const fref = ref<any>();

const blank = () => ({
  productName: '',
  productModel: '',
  manufacturer: '',
  date: new Date().toISOString().slice(0, 10),
  remark: '',
  attachments: [] as any[],
});

const form = reactive(blank());
const rules = {
  productName: [{ required: true, message: '必填', trigger: 'blur' }],
  productModel: [{ required: true, message: '必填', trigger: 'blur' }],
  manufacturer: [{ required: true, message: '必填', trigger: 'blur' }],
};

async function loadDetail() {
  const d: any = await inventoryApi.detail(id);
  Object.assign(form, d);
  if (d.date) form.date = new Date(d.date).toISOString().slice(0, 10);
  if (typeof d.attachments === 'string') {
    try {
      form.attachments = JSON.parse(d.attachments);
    } catch {
      form.attachments = [];
    }
  } else if (Array.isArray(d.attachments)) {
    form.attachments = d.attachments;
  }
}

function goBack() {
  // 统一方案 A：history.back() 优先；无历史栈时跳到本模块列表
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/biz/inventory');
  }
}

async function save() {
  try {
    await fref.value?.validate();
  } catch (errs: any) {
    const missing = Object.keys(errs || {})
      .map((k) => ({ productName: '商品名称', productModel: '商品型号', manufacturer: '厂家' }[k] || k))
      .filter(Boolean);
    await ElMessageBox.alert(
      `请填写以下必填字段后再确认：\n${missing.join('、')}`,
      '必填字段未填',
      { type: 'warning', confirmButtonText: '我知道了', dangerouslyUseHTMLString: false },
    );
    return;
  }
  const payload: any = {
    productName: form.productName,
    productModel: form.productModel,
    manufacturer: form.manufacturer,
    date: form.date ? new Date(form.date).toISOString() : undefined,
    remark: form.remark || null,
    attachments: form.attachments.length ? form.attachments : null,
  };
  try {
    if (isEdit.value) await inventoryApi.update(id, payload);
    else await inventoryApi.create(payload);
    ElMessage.success(isEdit.value ? '已更新' : '已创建');
    router.push('/biz/inventory');
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(async () => {
  if (isEdit.value) await loadDetail();
});
</script>
