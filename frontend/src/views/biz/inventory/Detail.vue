<template>
  <div v-if="ready">
    <el-card>
      <el-page-header @back="goBack" :content="isEdit ? '编辑库存' : '库存详情'" style="margin-bottom: 16px" />
      <el-descriptions :column="2" border>
        <el-descriptions-item label="序号">{{ data.seq || '-' }}</el-descriptions-item>
        <el-descriptions-item label="商品名称">{{ data.productName }}</el-descriptions-item>
        <el-descriptions-item label="商品型号">{{ data.productModel }}</el-descriptions-item>
        <el-descriptions-item label="厂家">{{ data.manufacturer }}</el-descriptions-item>
        <el-descriptions-item label="日期">{{ fmt(data.date) }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ data.createdBy?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          <pre style="white-space: pre-wrap; margin: 0">{{ data.remark || '-' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="附件" :span="2">
          <AttachmentList :list="getAttachments()" />
        </el-descriptions-item>
      </el-descriptions>
      <div style="margin-top: 20px; text-align: right">
        <el-button @click="$router.replace('/biz/inventory')">返回列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { inventoryApi } from '@/api';
import AttachmentList from '@/components/AttachmentList.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const isEdit = computed(() => route.name === 'inventory-edit');
const data = ref<any>({});
const ready = ref(false);

// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/biz/inventory');
  }
}

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

function getAttachments() {
  const a = data.value.attachments;
  if (!a) return [];
  if (Array.isArray(a)) return a;
  try {
    return JSON.parse(a);
  } catch {
    return [];
  }
}

onMounted(async () => {
  data.value = await inventoryApi.detail(id);
  ready.value = true;
});
</script>
