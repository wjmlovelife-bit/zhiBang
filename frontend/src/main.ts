import { createApp } from 'vue';
import { createPinia } from 'pinia';
// 3.1 element-plus 改为按需引入：组件通过 unplugin-vue-components 自动注册
//     删除了旧的两行：import ElementPlus from 'element-plus' / import 'element-plus/dist/index.css' / app.use(ElementPlus)
//     模板里用到的 <el-button>、<el-table> 等会自动按需 import，无需改动任何 .vue 文件
import App from './App.vue';
import router from './router';
import { setupPermDirective } from './directive/perm';
import { logger } from './utils/logger';
import './style.css';

logger.debug('[boot] main.ts module evaluated at ' + new Date().toISOString());

try {
  const app = createApp(App);
  logger.debug('[boot] createApp OK');
  // 3.1 icon 改为按需：原 main.ts:5,17-19 全量 import 会把整个 icons 包塞进 main bundle。
  //     现在各页面（如 sales-schedule/Index.vue）已独立 import 自己用到的 icon，
  //     这里不再做任何 icon 注册。如有遗漏的全局 icon，可在具体 .vue 里 import 后局部注册。
  app.use(createPinia());
  logger.debug('[boot] pinia installed');
  app.use(router);
  logger.debug('[boot] router installed');
  // 3.1 移除 app.use(ElementPlus)，按需引入由 unplugin-vue-components 自动处理
  logger.debug('[boot] element-plus on-demand enabled');
  setupPermDirective(app);
  logger.debug('[boot] perm directive installed');

  // ===== 12. 全局错误兜底（2026-09-23 加）=====
  // 三层兜底，避免单点异常把页面打白屏：
  //   1) app.config.errorHandler: Vue render/watch 抛错（非 onErrorCaptured 已捕获的）
  //   2) window 'unhandledrejection': Promise 未捕获 reject（接口/异步）
  //   3) router.onError: 路由懒加载失败（动态 import 异常）
  app.config.errorHandler = (err, instance, info) => {
    // 已在 ErrorBoundary 子树捕获的不再弹全局，避免重复告警
    logger.error('[vue:errorHandler]', info, err);
  };

  window.addEventListener('unhandledrejection', (e) => {
    logger.error('[vue:unhandledrejection]', e.reason);
  });

  router.onError((err) => {
    logger.error('[vue:routerError]', err);
  });

  app.mount('#app');
  logger.debug('[boot] app mounted OK');
} catch (err) {
  logger.error('[boot] app init failed', err);
  const show = (window as any).__showFatal;
  if (show) show('[boot] app init failed\n' + (err && (err as any).stack ? (err as any).stack : err));
  throw err;
}