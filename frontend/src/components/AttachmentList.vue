<template>
  <div class="attachment-list">
    <div v-if="!list || !list.length" class="att-empty">暂无附件</div>
    <div v-for="(a, i) in list" :key="i" class="att-item">
      <!-- 图片：缩略图 + 点击放大预览 -->
      <template v-if="isImage(a)">
        <el-image
          :src="getDownloadUrl(a)"
          :preview-src-list="previewList"
          :initial-index="i"
          fit="cover"
          hide-on-click-modal
          class="att-thumb"
          :title="`点击预览：${a.name}`"
        />
        <a
          class="att-name"
          :href="getDownloadUrl(a)"
          :download="a.name"
          @click.prevent="download(a)"
          :title="`点击下载：${a.name}`"
        >
          {{ a.name }}
        </a>
        <div v-if="a.size" class="att-size">{{ formatSize(a.size) }}</div>
      </template>
      <!-- 非图片：图标 + 文件名 + 点击下载 -->
      <template v-else>
        <el-icon class="att-icon" :size="36"><component :is="getFileIcon(a)" /></el-icon>
        <a
          class="att-name"
          :href="getDownloadUrl(a)"
          :download="a.name"
          @click.prevent="download(a)"
          :title="`点击下载：${a.name}`"
        >
          {{ a.name }}
        </a>
        <div v-if="a.size" class="att-size">{{ formatSize(a.size) }}</div>
      </template>
      <!-- 移除按钮（编辑态可见） -->
      <el-button
        v-if="removable"
        link
        type="danger"
        size="small"
        class="att-remove"
        @click="$emit('remove', i)"
      >
        移除
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAttachments, type Attachment } from '@/composables/useAttachments';

const props = defineProps<{
  list: Attachment[];
  removable?: boolean;
}>();

defineEmits<{
  (e: 'remove', index: number): void;
}>();

const { isImage, getDownloadUrl, download, getFileIcon, formatSize } = useAttachments();

// el-image 预览需要完整 URL 列表
const previewList = computed(() => props.list.filter(isImage).map(getDownloadUrl));
</script>

<style scoped>
.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.att-empty {
  color: #c0c4cc;
  font-size: 12px;
  padding: 8px 0;
}
.att-item {
  position: relative;
  width: 140px;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fafafa;
}
.att-thumb {
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
}
.att-thumb :deep(img) {
  cursor: zoom-in;
}
.att-icon {
  margin: 32px 0 12px;
  color: #909399;
}
.att-name {
  display: block;
  font-size: 12px;
  color: #409eff;
  margin-top: 8px;
  text-align: center;
  width: 100%;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.att-name:hover {
  text-decoration: underline;
  color: #66b1ff;
}
.att-size {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
.att-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.85);
}
</style>