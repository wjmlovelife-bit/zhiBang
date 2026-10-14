/**
 * module/action 字典
 * - module: 中文模块名（前端 UI 显示 + 审计报表用）
 * - action: 由 HTTP method 推导（POST=创建, PUT=更新, DELETE=删除, PATCH=部分更新）
 *
 * 推断优先级：
 * 1) controller 上 @OperLog({ module, action }) 装饰器（精确）
 * 2) url prefix 匹配 MODULE_MAP（粗略覆盖）
 * 3) 默认 '其他'
 *
 * url 匹配按最长匹配优先（避免 /api/sys/users 被 /api/sys 截走）
 */
export const MODULE_MAP: { prefix: string; name: string }[] = [
  { prefix: '/api/customer', name: '客户' },
  { prefix: '/api/project', name: '项目' },
  { prefix: '/api/quotation', name: '报价' },
  { prefix: '/api/contract', name: '合同' },
  { prefix: '/api/worklog', name: '工作日志' },
  { prefix: '/api/sales-schedule', name: '销售日程' },
  { prefix: '/api/weekly-schedule', name: '非销售日程' },
  { prefix: '/api/stats', name: '数据统计' },
  { prefix: '/api/sys/users', name: '系统-用户' },
  { prefix: '/api/sys/roles', name: '系统-角色' },
  { prefix: '/api/sys/menus', name: '系统-菜单' },
  { prefix: '/api/sys/operations', name: '系统-操作权限' },
  { prefix: '/api/sys/depts', name: '系统-部门' },
  { prefix: '/api/sys/dict', name: '系统-字典' },
  { prefix: '/api/sys/regions', name: '系统-区域' },
  { prefix: '/api/sys/company', name: '系统-公司信息' },
  { prefix: '/api/upload', name: '文件上传' },
  { prefix: '/api/inventory', name: '库存' },
  { prefix: '/api/purchase', name: '采购' },
  { prefix: '/api/follow', name: '跟进' },
  { prefix: '/api/auth', name: '认证' },
];

/** 根据 url 推断模块名（最长前缀匹配） */
export function inferModule(url: string): string {
  // 去掉 query string
  const path = url.split('?')[0];
  // 按 prefix 长度倒序排，命中第一个
  const sorted = [...MODULE_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const m of sorted) {
    if (path.startsWith(m.prefix)) return m.name;
  }
  return '其他';
}

export const ACTION_MAP: Record<string, string> = {
  POST: '创建',
  PUT: '更新',
  PATCH: '更新',
  DELETE: '删除',
};

export function inferAction(method: string): string {
  return ACTION_MAP[method?.toUpperCase()] || '其他';
}