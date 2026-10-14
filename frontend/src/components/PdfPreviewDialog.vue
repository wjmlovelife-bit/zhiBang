<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="82%"
    top="5vh"
    @update:model-value="$emit('update:visible', $event)"
  >
    <iframe
      v-if="visible && url"
      :src="url"
      frameborder="0"
      style="width: 100%; height: 72vh; border: 1px solid #eee"
    ></iframe>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
      <el-button type="primary">
        <a :href="downloadUrl" :download="title" target="_blank" style="color: inherit; text-decoration: none">
          下载 PDF
        </a>
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; url: string; title: string; downloadUrl: string }>();
defineEmits<{ 'update:visible': [boolean] }>();
</script>
