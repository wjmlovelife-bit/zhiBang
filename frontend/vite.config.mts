import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import compression from 'vite-plugin-compression';
import path from 'path';

export default defineConfig({
  plugins: [
    // 3.1 element-plus 按需：组件自动注册（无需在模板里 import ElButton 等）
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
    // 3.3 gzip 预压缩：build 时生成 .gz 文件，serve-frontend.mjs 检测 Content-Encoding 返回
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    // R21 B-3（2026-09-28）：移除 vite-plugin-pwa + dist 中的 sw.js/workbox-*/manifest.webmanifest
    //   - 内网 CRM 不需要离线缓存（员工不会断网工作）
    //   - SW 二次访问的加速被 tunnel 物理延迟（500-1000ms）盖过，无收益
    //   - SW 与 chrome extension 通信会抛 "Could not establish connection" 噪声错误
    //   - 节省 dist ~25 KB（sw.js 4 + workbox 22 + registerSW 0.1 + manifest 0.2）
    vue(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    // 14c（2026-09-23 加注释）：勿删此行！否则 vite 只监听 localhost，
    // 局域网访问时（如手机/同事电脑）会被拒，触发偶发空白页。
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: {
    // 3.2 manualChunks：把 element-plus / icons / vue 全家桶拆成独立 chunk，并行下载
    // R21 B-2：xlsx 改为动态 import（await import('xlsx')）后会被 rollup 自动拆为独立 chunk，
    //         这里**不要**把它 catch-all 进 vendor——返回 undefined 让 rollup 默认处理
    //         （否则会被兜底 'vendor' 吸进去，前功尽弃）
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // xlsx 走 await import，按 dynamic import 自动拆（不要 catch-all 进 vendor）
          if (id.includes('xlsx')) return undefined;
          if (id.includes('@element-plus/icons-vue')) return 'el-icons';
          if (id.includes('element-plus')) return 'element-plus';
          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vue-vendor';
          // 其它 node_modules：走默认（按 dynamic import 自动拆，不强行塞 vendor）
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false, // 生产构建不要 sourcemap，减小体积
  },
});