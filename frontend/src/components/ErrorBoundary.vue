<!--
  全局错误边界组件（Vue 3 onErrorCaptured）
  - 包住 router-view/任何子树后，子树 render 异常不会再白屏
  - 显示友好错误页 + 重试按钮（点重试重新挂载子树）
  - 同时把异常信息打 console，并附当前路由与时间，便于定位
  - 上层 app.config.errorHandler 已经兜过一次，这里只负责"展示降级 UI"
-->
<template>
  <div v-if="err" class="ct-error-boundary">
    <div class="ct-eb-card">
      <div class="ct-eb-icon">⚠️</div>
      <div class="ct-eb-title">页面出错了</div>
      <div class="ct-eb-msg">{{ err.message || '未知错误' }}</div>
      <div class="ct-eb-meta" v-if="err.route">
        路由：{{ err.route }}<br />
        时间：{{ err.time }}
      </div>
      <div class="ct-eb-actions">
        <el-button type="primary" @click="retry">重试</el-button>
        <el-button @click="goHome">返回工作台</el-button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { logger } from '@/utils/logger';

interface ErrInfo {
  message: string;
  stack?: string;
  route: string;
  time: string;
}

const err = ref<ErrInfo | null>(null);
const router = useRouter();
const route = useRoute();

// 子树 render 抛错时触发
onErrorCaptured((e: any) => {
  // 已在错误态：忽略后续，避免反复覆盖
  if (err.value) return false;

  const info: ErrInfo = {
    message: String(e?.message || e || '未知错误'),
    stack: e instanceof Error ? e.stack : undefined,
    route: route.fullPath,
    time: new Date().toISOString(),
  };
  logger.error('[ErrorBoundary] caught component error', info);
  err.value = info;

  // 返回 false：阻止异常继续向上传播，避免叠加到 app.config.errorHandler 后再抛一次
  return false;
});

// 重试：清掉 err，让子树重新渲染（v-if 卸载后会再挂载一次）
function retry() {
  err.value = null;
}

function goHome() {
  err.value = null;
  router.push('/dashboard');
}
</script>

<style scoped>
.ct-error-boundary {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ct-eb-card {
  max-width: 480px;
  text-align: center;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 32px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.ct-eb-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.ct-eb-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.ct-eb-msg {
  font-size: 14px;
  color: #606266;
  word-break: break-word;
  margin-bottom: 12px;
}
.ct-eb-meta {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin-bottom: 16px;
}
.ct-eb-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>