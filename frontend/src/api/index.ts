import request from './request';

export const authApi = {
  login: (username: string, password: string) => request.post('/auth/login', { username, password }),
  // 管理员改任意用户密码（含自己），body 必须含原密码
  changeUserPassword: (userId: number, body: { oldPassword: string; newPassword: string }) =>
    request.post(`/sys/users/${userId}/change-password`, body),
  // 用户关闭"密码已被重置"提示后调此接口清标记
  clearPasswordFlag: () => request.post('/auth/clear-password-flag'),
};

export const sysApi = {
  dict: (type?: string) => request.get('/sys/dict', { params: { type } }),
  dictMap: (types: string[]) => request.get('/sys/dict-map', { params: { types: types.join(',') } }),
  // 菜单
  menus: () => request.get('/sys/menus'), // 当前用户可见菜单树
  menusAll: () => request.get('/sys/menus-all'), // 全部菜单（扁平，分配用）
  menuCreate: (data: any) => request.post('/sys/menus', data),
  menuUpdate: (id: number, data: any) => request.put(`/sys/menus/${id}`, data),
  menuDelete: (id: number) => request.delete(`/sys/menus/${id}`),
  // 部门
  depts: () => request.get('/sys/depts'),
  deptCreate: (data: any) => request.post('/sys/depts', data),
  deptUpdate: (id: number, data: any) => request.put(`/sys/depts/${id}`, data),
  deptDelete: (id: number) => request.delete(`/sys/depts/${id}`),
  // 操作目录
  operations: () => request.get('/sys/operations'),
  operationCreate: (data: any) => request.post('/sys/operations', data),
  operationUpdate: (id: number, data: any) => request.put(`/sys/operations/${id}`, data),
  operationDelete: (id: number) => request.delete(`/sys/operations/${id}`),
  // 角色
  roles: () => request.get('/sys/roles'),
  roleCreate: (data: any) => request.post('/sys/roles', data),
  roleUpdate: (id: number, data: any) => request.put(`/sys/roles/${id}`, data),
  roleDelete: (id: number) => request.delete(`/sys/roles/${id}`),
  roleMenus: (id: number) => request.get(`/sys/roles/${id}/menus`),
  roleSetMenus: (id: number, menuIds: number[]) => request.put(`/sys/roles/${id}/menus`, { menuIds }),
  roleOps: (id: number) => request.get(`/sys/roles/${id}/operations`),
  roleSetOps: (id: number, codes: string[]) => request.put(`/sys/roles/${id}/operations`, { codes }),
  // 用户
  users: (keyword?: string) => request.get('/sys/users', { params: { keyword } }),
  usersPage: (q: any) => request.get('/sys/users/list', { params: q }),
  userCreate: (data: any) => request.post('/sys/users', data),
  userUpdate: (id: number, data: any) => request.put(`/sys/users/${id}`, data),
  userDelete: (id: number) => request.delete(`/sys/users/${id}`),
  userMenus: (id: number) => request.get(`/sys/users/${id}/menus`),
  userSetMenus: (id: number, menuIds: number[]) => request.put(`/sys/users/${id}/menus`, { menuIds }),
  userOps: (id: number) => request.get(`/sys/users/${id}/operations`),
  userSetOps: (id: number, codes: string[]) => request.put(`/sys/users/${id}/operations`, { codes }),
  userApplyRole: (id: number, roleId: number) => request.post(`/sys/users/${id}/apply-role/${roleId}`),
  userTemplate: () => request.get('/sys/users/template', { responseType: 'blob' }),
  userImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request.post('/sys/users/import', fd);
  },
  // 地区（兼容旧接口）
  regions: (parentId?: number) => request.get('/sys/regions', { params: { parentId } }),
  regionsTree: () => request.get('/sys/regions-tree'),
  // 公司信息（单例）
  company: () => request.get('/sys/company'),
  companyUpdate: (data: any) => request.put('/sys/company', data),
};

export const customerApi = {
  list: (q: any) => request.get('/customer/list', { params: q }),
  detail: (id: number) => request.get(`/customer/${id}`),
  create: (data: any) => request.post('/customer', data),
  update: (id: number, data: any) => request.put(`/customer/${id}`, data),
  remove: (id: number) => request.delete(`/customer/${id}`),
  nextCode: () => request.get('/customer/next-code'),
  search: (keyword: string) => request.get('/customer/search', { params: { keyword } }),
  inherit: (id: number, toUserId: number, reason: string) =>
    request.post(`/customer/${id}/inherit`, { toUserId, reason }),
  follows: (id: number) => request.get(`/customer/${id}/follows`),
  addFollow: (id: number, data: any) => request.post(`/customer/${id}/follow`, data),
  updateFollow: (id: number, followId: number, data: any) =>
    request.put(`/customer/${id}/follow/${followId}`, data),
  deleteFollow: (id: number, followId: number) =>
    request.delete(`/customer/${id}/follow/${followId}`),
};

export const projectApi = {
  list: (q: any) => request.get('/project/list', { params: q }),
  detail: (id: number) => request.get(`/project/${id}`),
  create: (data: any) => request.post('/project', data),
  update: (id: number, data: any) => request.put(`/project/${id}`, data),
  remove: (id: number) => request.delete(`/project/${id}`),
  nextCode: () => request.get('/project/next-code'),
  searchCustomer: (keyword: string) => request.get('/project/search-customer', { params: { keyword } }),
  searchContract: (keyword: string) => request.get('/project/search-contract', { params: { keyword } }),
  inherit: (id: number, toUserId: number, reason: string) =>
    request.post(`/project/${id}/inherit`, { toUserId, reason }),
  follows: (id: number) => request.get(`/project/${id}/follow`),
  addFollow: (id: number, data: any) => request.post(`/project/${id}/follow`, data),
  updateFollow: (id: number, followId: number, data: any) =>
    request.put(`/project/${id}/follow/${followId}`, data),
  deleteFollow: (id: number, followId: number) =>
    request.delete(`/project/${id}/follow/${followId}`),
  importPreview: (rows: any[]) => request.post('/project/import-preview', { rows }),
  importConfirm: (rows: any[]) => request.post('/project/import-confirm', { rows }),
  exportUrl: (ids?: number[]) => `/api/project/export${ids && ids.length ? `?ids=${ids.join(',')}` : ''}`,
  pdfUrl: (id: number) => `/api/project/pdf/${id}`,
};

/**
 * 跟进公共接口：拉取某跟进人名下所有客户的所有联系人，作为跟进记录"客户联系人"下拉的候选池。
 */
export const followApi = {
  contacts: (followerId: number) =>
    request.get('/follow/contacts', { params: { followerId } }),
};

/**
 * 非销售日程管理：按 (ownerId, weekStart) 一周一条记录。
 */
export const weeklyScheduleApi = {
  get: (weekStart: string, ownerId?: number) =>
    request.get('/weekly-schedule', { params: { weekStart, ownerId } }),
  save: (data: any) => request.put('/weekly-schedule', data),
  exportBlob: (weekStart: string, ownerId?: number) =>
    request.get('/weekly-schedule/export', {
      params: { weekStart, ownerId },
      responseType: 'blob',
    }) as unknown as Promise<Blob>,
};

/**
 * 销售日程管理：按 (ownerId, weekStart) 拉一周数据。
 * 顶部 3 段可编辑；第 3-8 列由后端从跟进记录实时聚合。
 */
export const salesScheduleApi = {
  get: (weekStart: string, ownerId?: number) =>
    request.get('/sales-schedule', { params: { weekStart, ownerId } }),
  save: (data: any) => request.put('/sales-schedule', data),
  exportBlob: (weekStart: string, ownerId?: number) =>
    request.get('/sales-schedule/export', {
      params: { weekStart, ownerId },
      responseType: 'blob',
    }) as unknown as Promise<Blob>,
};

export const quotationApi = {
  list: (q: any) => request.get('/quotation/list', { params: q }),
  detail: (id: number) => request.get(`/quotation/${id}`),
  create: (data: any) => request.post('/quotation', data),
  update: (id: number, data: any) => request.put(`/quotation/${id}`, data),
  remove: (id: number) => request.delete(`/quotation/${id}`),
  nextCode: () => request.get('/quotation/next-code'),
  searchCustomer: (keyword: string) => request.get('/quotation/search-customer', { params: { keyword } }),
  pdfUrl: (id: number) => `/api/quotation/pdf/${id}`,
};

export const contractApi = {
  list: (q: any) => request.get('/contract/list', { params: q }),
  detail: (id: number) => request.get(`/contract/${id}`),
  create: (data: any) => request.post('/contract', data),
  update: (id: number, data: any) => request.put(`/contract/${id}`, data),
  remove: (id: number) => request.delete(`/contract/${id}`),
  nextCode: () => request.get('/contract/next-code'),
  pdfUrl: (id: number) => `/api/contract/pdf/${id}`,
};

export const worklogApi = {
  list: (q: any) => request.get('/worklog', { params: q }),
  detail: (id: number) => request.get(`/worklog/${id}`),
  create: (data: any) => request.post('/worklog', data),
  update: (id: number, data: any) => request.put(`/worklog/${id}`, data),
  remove: (id: number) => request.delete(`/worklog/${id}`),
  nextCode: () => request.get('/worklog/next-code'),
  searchCustomer: (keyword: string) => request.get('/worklog/search-customer', { params: { keyword } }),
  searchProject: (keyword: string) => request.get('/worklog/search-project', { params: { keyword } }),
  // 本周工作总结
  weeklySummary: () => request.get('/worklog/weekly-summary'),
  weeklySummaryList: (page: number, pageSize: number, filters?: { keyword?: string; ownerId?: number | string; dateStart?: string; dateEnd?: string }) =>
    request.get('/worklog/weekly-summary/list', {
      params: {
        page,
        pageSize,
        keyword: filters?.keyword || undefined,
        ownerId: filters?.ownerId || undefined,
        dateStart: filters?.dateStart || undefined,
        dateEnd: filters?.dateEnd || undefined,
      },
    }),
  weeklySummarySave: (data: any) => request.put('/worklog/weekly-summary', data),
  weeklySummaryDelete: (weekStart: string) => request.delete(`/worklog/weekly-summary/${weekStart}`),
};

// 商务管理 → 库存
export const inventoryApi = {
  list: (q: any) => request.get('/inventory/list', { params: q }),
  detail: (id: number) => request.get(`/inventory/${id}`),
  create: (data: any) => request.post('/inventory', data),
  update: (id: number, data: any) => request.put(`/inventory/${id}`, data),
  remove: (id: number) => request.delete(`/inventory/${id}`),
  exportAll: () => request.get('/inventory/export'),
};

// 商务管理 → 采购
export const purchaseApi = {
  list: (q: any) => request.get('/purchase/list', { params: q }),
  detail: (id: number) => request.get(`/purchase/${id}`),
  create: (data: any) => request.post('/purchase', data),
  update: (id: number, data: any) => request.put(`/purchase/${id}`, data),
  remove: (id: number) => request.delete(`/purchase/${id}`),
  exportAll: () => request.get('/purchase/export'),
};

// 数据统计（销售数据统计）
// 后端仅 admin 能访问（isAdmin=true 短路 + stats:view/stats:export 守卫）
export const statsApi = {
  salesSummary: (params?: { userId?: number; dateFrom?: string; dateTo?: string }) =>
    request.get('/stats/sales-summary', { params }),
  salesExportUrl: (params?: { userId?: number; dateFrom?: string; dateTo?: string }) => {
    const usp = new URLSearchParams();
    if (params?.userId) usp.set('userId', String(params.userId));
    if (params?.dateFrom) usp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) usp.set('dateTo', params.dateTo);
    const q = usp.toString();
    return `/api/stats/sales-export${q ? '?' + q : ''}`;
  },
};
