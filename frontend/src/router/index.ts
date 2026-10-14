import { createRouter, createWebHistory } from 'vue-router';
// 3.5 DefaultLayout 改为按需 import：原同步 import 会让所有页面打开前都加载 layout（含 sidebar/header/el-menu）
import Login from '@/views/login/index.vue';

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  {
    path: '/',
    component: () => import(/* webpackChunkName: "layout" */ '@/layout/DefaultLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '工作台' } },
      { path: 'sales/customer', name: 'customer-list', component: () => import('@/views/sales/customer/List.vue'), meta: { title: '客户列表' } },
      { path: 'sales/customer/new', name: 'customer-new', component: () => import('@/views/sales/customer/Form.vue'), meta: { title: '新建客户' } },
      { path: 'sales/customer/:id', name: 'customer-edit', component: () => import('@/views/sales/customer/Form.vue'), meta: { title: '编辑客户' } },
      { path: 'sales/customer/:id/detail', name: 'customer-detail', component: () => import('@/views/sales/customer/Detail.vue'), meta: { title: '客户详情' } },
      { path: 'sales/customer/import', name: 'customer-import', component: () => import('@/views/sales/customer/Import.vue'), meta: { title: '导入客户' } },
      { path: 'sales/project', name: 'project-list', component: () => import('@/views/sales/project/List.vue'), meta: { title: '项目列表' } },
      { path: 'sales/project/new', name: 'project-new', component: () => import('@/views/sales/project/Form.vue'), meta: { title: '新建项目' } },
      { path: 'sales/project/:id', name: 'project-edit', component: () => import('@/views/sales/project/Form.vue'), meta: { title: '编辑项目' } },
      { path: 'sales/project/import', name: 'project-import', component: () => import('@/views/sales/project/Import.vue'), meta: { title: '导入项目' } },
      { path: 'sales/quotation', name: 'quotation-list', component: () => import('@/views/sales/quotation/List.vue'), meta: { title: '报价列表' } },
      { path: 'sales/quotation/new', name: 'quotation-new', component: () => import('@/views/sales/quotation/Form.vue'), meta: { title: '新建报价' } },
      { path: 'sales/quotation/:id', name: 'quotation-edit', component: () => import('@/views/sales/quotation/Form.vue'), meta: { title: '编辑报价' } },
      { path: 'sales/contract', name: 'contract-list', component: () => import('@/views/sales/contract/List.vue'), meta: { title: '合同列表' } },
      { path: 'sales/contract/new', name: 'contract-new', component: () => import('@/views/sales/contract/Form.vue'), meta: { title: '新建合同' } },
      { path: 'sales/contract/:id', name: 'contract-edit', component: () => import('@/views/sales/contract/Form.vue'), meta: { title: '编辑合同' } },
      { path: 'sales/worklog', name: 'worklog-list', component: () => import('@/views/sales/worklog/List.vue'), meta: { title: '日志列表' } },
      { path: 'sales/worklog/new', name: 'worklog-new', component: () => import('@/views/sales/worklog/Form.vue'), meta: { title: '新建日志' } },
      { path: 'sales/worklog/:id', name: 'worklog-edit', component: () => import('@/views/sales/worklog/Form.vue'), meta: { title: '编辑日志' } },
      { path: 'sales/weekly-schedule', name: 'weekly-schedule', component: () => import('@/views/sales/weekly-schedule/Index.vue'), meta: { title: '非销售日程管理' } },
      { path: 'sales/sales-schedule', name: 'sales-schedule', component: () => import('@/views/sales/sales-schedule/Index.vue'), meta: { title: '销售日程管理' } },
      // 数据统计
      { path: 'stats/sales', name: 'stats-sales', component: () => import('@/views/stats/sales/Index.vue'), meta: { title: '销售数据统计' } },
      // 系统管理
      { path: 'system/user', name: 'system-user', component: () => import('@/views/system/user/List.vue'), meta: { title: '用户管理' } },
      { path: 'system/role', name: 'system-role', component: () => import('@/views/system/role/List.vue'), meta: { title: '角色管理' } },
      { path: 'system/dept', name: 'system-dept', component: () => import('@/views/system/dept/List.vue'), meta: { title: '部门管理' } },
      { path: 'system/menu', name: 'system-menu', component: () => import('@/views/system/menu/List.vue'), meta: { title: '菜单管理' } },
      { path: 'system/operation', name: 'system-operation', component: () => import('@/views/system/operation/List.vue'), meta: { title: '操作权限' } },
      { path: 'system/company', name: 'system-company', component: () => import('@/views/system/company/Info.vue'), meta: { title: '公司信息' } },
      // 商务管理
      { path: 'biz/inventory', name: 'inventory-list', component: () => import('@/views/biz/inventory/List.vue'), meta: { title: '库存列表', perm: 'biz:inventory:view' } },
      { path: 'biz/inventory/new', name: 'inventory-new', component: () => import('@/views/biz/inventory/Form.vue'), meta: { title: '新建库存', perm: 'biz:inventory:create' } },
      { path: 'biz/inventory/import', name: 'inventory-import', component: () => import('@/views/biz/inventory/Import.vue'), meta: { title: '导入库存', perm: 'biz:inventory:import' } },
      { path: 'biz/inventory/:id', name: 'inventory-edit', component: () => import('@/views/biz/inventory/Form.vue'), meta: { title: '编辑库存', perm: 'biz:inventory:update' } },
      { path: 'biz/inventory/:id/detail', name: 'inventory-detail', component: () => import('@/views/biz/inventory/Detail.vue'), meta: { title: '库存详情', perm: 'biz:inventory:view' } },
      { path: 'biz/purchase', name: 'purchase-list', component: () => import('@/views/biz/purchase/List.vue'), meta: { title: '采购列表', perm: 'biz:purchase:view' } },
      { path: 'biz/purchase/new', name: 'purchase-new', component: () => import('@/views/biz/purchase/Form.vue'), meta: { title: '新建采购', perm: 'biz:purchase:create' } },
      { path: 'biz/purchase/import', name: 'purchase-import', component: () => import('@/views/biz/purchase/Import.vue'), meta: { title: '导入采购', perm: 'biz:purchase:import' } },
      { path: 'biz/purchase/:id', name: 'purchase-edit', component: () => import('@/views/biz/purchase/Form.vue'), meta: { title: '编辑采购', perm: 'biz:purchase:update' } },
      { path: 'biz/purchase/:id/detail', name: 'purchase-detail', component: () => import('@/views/biz/purchase/Detail.vue'), meta: { title: '采购详情', perm: 'biz:purchase:view' } },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (!to.meta.public && !token) next('/login');
  else if (to.path === '/login' && token) next('/');
  else next();
});

export default router;
