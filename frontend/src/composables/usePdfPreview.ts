import { createApp, h, reactive } from 'vue';
// 3.1 PDF 预览弹窗是独立 Vue app 实例（main.ts 的 unplugin-vue-components 不会自动处理子 app）
//    按需注册弹窗里用到的组件：ElDialog + ElButton（PdfPreviewDialog.vue 用了这两个）
import { ElDialog, ElButton } from 'element-plus';
import PdfPreviewDialog from '@/components/PdfPreviewDialog.vue';

let instance: any = null;
const state = reactive({ visible: false, url: '', title: '', downloadUrl: '' });

// 以弹窗(iframe 内联预览)方式打开 PDF；chrome 会自动在 iframe 中渲染 PDF
// url 需带 ?token= 以便后端 JWT 守卫放行(iframe 请求不带 Authorization 头)
export function openPdfPreview(url: string, fileName = 'document.pdf') {
  state.url = url;
  state.title = fileName;
  state.downloadUrl = url + (url.includes('?') ? '&' : '?') + 'download=1';
  state.visible = true;
  if (!instance) {
    const mountNode = document.createElement('div');
    document.body.appendChild(mountNode);
    const app = createApp({
      render: () =>
        h(PdfPreviewDialog, {
          visible: state.visible,
          url: state.url,
          title: state.title,
          downloadUrl: state.downloadUrl,
          'onUpdate:visible': (v: boolean) => {
            state.visible = v;
          },
        }),
    });
    // 该弹窗是独立 app 实例，main.ts 的 unplugin-vue-components 不生效，必须手动挂载 element-plus 组件
    //    3.1 改为按需：只注册弹窗里实际用到的 ElDialog 和 ElButton，避免拉全量（之前 app.use(ElementPlus) 会拖 1.25MB）
    app.use(ElDialog);
    app.use(ElButton);
    instance = app.mount(mountNode);
  }
}
