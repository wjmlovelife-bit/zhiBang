<template>
  <div class="attachment-uploader">
    <el-upload
      v-if="!disabled"
      :auto-upload="true"
      :show-file-list="false"
      :http-request="customUpload"
      :before-upload="beforeUpload"
      class="att-upload"
    >
      <el-button size="small" type="primary">
        <el-icon style="margin-right: 4px"><Upload /></el-icon>
        上传附件
      </el-button>
      <template #tip>
        <div style="color: #999; font-size: 12px">支持图片及常见文档，单文件 ≤ 20MB</div>
      </template>
    </el-upload>
    <AttachmentList :list="modelValue" :removable="!disabled" @remove="onRemove" />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import AttachmentList from './AttachmentList.vue';
import request from '@/api/request';
import type { Attachment } from '@/composables/useAttachments';

const props = withDefaults(defineProps<{
  modelValue: Attachment[];
  disabled?: boolean;
}>(), { disabled: false });

const emit = defineEmits<{
  (e: 'update:modelValue', list: Attachment[]): void;
}>();

/** 20MB 上限 */
function beforeUpload(file: any) {
  const ok = file.size / 1024 / 1024 < 20;
  if (!ok) ElMessage.error('文件不能超过 20MB');
  return ok;
}

/** 自定义上传（避开 el-upload 的 action 默认走法，统一走 /api/upload） */
async function customUpload(options: any) {
  const fd = new FormData();
  fd.append('file', options.file);
  try {
    const r: any = await request.post('/upload', fd);
    // 后端已做 UTF-8 解码，直接用 originalname
    const next = [
      ...props.modelValue,
      { url: r.url, name: r.originalname || options.file.name, size: r.size, mimetype: r.mimetype },
    ];
    emit('update:modelValue', next);
    ElMessage.success('上传成功');
  } catch {
    ElMessage.error('上传失败');
  }
}

function onRemove(i: number) {
  const next = props.modelValue.slice();
  next.splice(i, 1);
  emit('update:modelValue', next);
}
</script>

<style scoped>
.attachment-uploader {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.att-upload {
  display: inline-block;
}
</style>
