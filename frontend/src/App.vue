<!--
  App.vue — 顶层结构
  - ErrorBoundary 包住 router-view：子树 render 异常时降级为友好错误页（避免白屏）
  - 主错误兜底仍在 main.ts 的 app.config.errorHandler（捕获所有 Vue 运行时错误）
  - 异步错误由 main.ts 的 window 'unhandledrejection' 兜底
-->
<template>
  <ErrorBoundary>
    <router-view />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import ErrorBoundary from '@/components/ErrorBoundary.vue';
</script>