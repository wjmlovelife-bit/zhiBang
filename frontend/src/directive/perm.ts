import type { App, Directive, DirectiveBinding } from 'vue';
import { useUserStore } from '@/store/user';

// v-perm 按钮/元素级权限控制：无权限则隐藏
// 用法：<el-button v-perm="'user:create'">新建</el-button>
//       <el-button v-perm="['role:update','role:delete']">编辑/删除</el-button>
const perm: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    apply(el, binding);
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    apply(el, binding);
  },
};

function apply(el: HTMLElement, binding: DirectiveBinding) {
  const store = useUserStore();
  const ok = store.hasPerm(binding.value);
  // 记录原始显示状态，便于权限变化时还原
  if (!el.hasAttribute('data-perm-origin')) {
    el.setAttribute('data-perm-origin', el.style.display || '');
  }
  el.style.display = ok ? (el.getAttribute('data-perm-origin') || '') : 'none';
}

export function setupPermDirective(app: App) {
  app.directive('perm', perm);
}
