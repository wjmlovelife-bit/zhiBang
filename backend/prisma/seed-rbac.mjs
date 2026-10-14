// RBAC 种子：6 角色 + 操作目录(SysOperation) + admin 标记 + 角色默认操作模板
// 幂等：重复运行安全（upsert / 先清后建模板）
//
// 重要：系统管理类的操作码必须与 sys.controller 中 @Permissions(...) 标注的码完全一致
// （如 'user:view'、'role:assign'），否则非管理员即便被授予也会被守卫拦截。
// 业务模块类操作码（crm:*/contract:* 等）为预留，待后续在业务 controller 加 @Permissions 时保持一致。
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

// 1) 角色定义：code, name, dataScope(1全部 2本部门及下级 3本部门 4本人 5自定义)
const ROLES = [
  { code: 'admin', name: '超级管理员', dataScope: 1, isSystem: true },
  { code: 'leader', name: '领导', dataScope: 2, isSystem: false },
  { code: 'sales', name: '销售', dataScope: 4, isSystem: false },
  { code: 'purchase', name: '采购', dataScope: 4, isSystem: false },
  { code: 'business', name: '商务', dataScope: 4, isSystem: false },
  { code: 'administrative', name: '行政', dataScope: 4, isSystem: false },
];

// 2) 操作目录：[module, group, code, name]
// 系统管理码必须与 @Permissions 标注一致；业务码为预留（全码）。
const M = [
  // ===== 系统管理（与 sys.controller @Permissions 严格一致）=====
  ['系统', '部门', 'dept:manage', '部门管理(增删改)'],
  ['系统', '菜单', 'menu:view', '查看菜单'],
  ['系统', '操作', 'operation:view', '查看操作'],
  ['系统', '操作', 'operation:create', '新建操作'],
  ['系统', '操作', 'operation:update', '编辑操作'],
  ['系统', '操作', 'operation:delete', '删除操作'],
  ['系统', '角色', 'role:view', '查看角色'],
  ['系统', '角色', 'role:create', '新建角色'],
  ['系统', '角色', 'role:update', '编辑角色'],
  ['系统', '角色', 'role:delete', '删除角色'],
  ['系统', '角色', 'role:assign', '角色分配'],
  ['系统', '用户', 'user:view', '查看用户'],
  ['系统', '用户', 'user:create', '新建用户'],
  ['系统', '用户', 'user:update', '编辑用户'],
  ['系统', '用户', 'user:delete', '删除用户'],
  ['系统', '用户', 'user:assign', '用户授权'],
  ['系统', '用户', 'user:import', '导入用户'],
  // ===== 业务模块（预留，全码）=====
  ['客户', '客户', 'crm:customer:view', '查看客户'],
  ['客户', '客户', 'crm:customer:create', '新建客户'],
  ['客户', '客户', 'crm:customer:update', '编辑客户'],
  ['客户', '客户', 'crm:customer:delete', '删除客户'],
  ['客户', '客户', 'crm:customer:import', '导入客户'],
  ['客户', '客户', 'crm:customer:export', '导出客户'],
  ['客户', '项目', 'crm:project:view', '查看项目'],
  ['客户', '项目', 'crm:project:create', '新建项目'],
  ['客户', '项目', 'crm:project:update', '编辑项目'],
  ['客户', '项目', 'crm:project:delete', '删除项目'],
  ['客户', '项目', 'crm:project:follow', '项目关注'],
  ['客户', '商机', 'crm:opportunity:view', '查看商机'],
  ['客户', '商机', 'crm:opportunity:create', '新建商机'],
  ['客户', '商机', 'crm:opportunity:update', '编辑商机'],
  ['客户', '商机', 'crm:opportunity:delete', '删除商机'],
  ['销售', '合同', 'contract:view', '查看合同'],
  ['销售', '合同', 'contract:create', '新建合同'],
  ['销售', '合同', 'contract:update', '编辑合同'],
  ['销售', '合同', 'contract:delete', '删除合同'],
  ['销售', '报价', 'quotation:view', '查看报价'],
  ['销售', '报价', 'quotation:create', '新建报价'],
  ['销售', '报价', 'quotation:update', '编辑报价'],
  ['销售', '报价', 'quotation:delete', '删除报价'],
  ['客户', '工作日志', 'worklog:view', '查看工作日志'],
  ['客户', '工作日志', 'worklog:create', '新建工作日志'],
  ['客户', '工作日志', 'worklog:update', '编辑工作日志'],
  ['客户', '工作日志', 'worklog:delete', '删除工作日志'],
  ['通用', '文件', 'upload:view', '查看附件'],
  ['通用', '文件', 'upload:create', '上传附件'],
  ['通用', '仪表盘', 'dashboard:view', '查看仪表盘'],
  // ===== 系统管理·公司信息 =====
  ['系统', '公司信息', 'company:view', '查看公司信息'],
  ['系统', '公司信息', 'company:update', '编辑公司信息'],
];

// 助手：按前缀筛选操作码
const codesOf = (pred) => M.filter(([, , c]) => pred(c)).map(([, , c]) => c);

async function main() {
  // 角色 upsert
  const roleIds = {};
  for (const r of ROLES) {
    const row = await p.sysRole.upsert({
      where: { code: r.code },
      update: { name: r.name, dataScope: r.dataScope, isSystem: r.isSystem },
      create: { code: r.code, name: r.name, dataScope: r.dataScope, isSystem: r.isSystem },
    });
    roleIds[r.code] = row.id;
  }
  console.log('roles:', roleIds);

  // 操作目录 upsert
  const opIdByCode = {};
  for (const [module, group, code, name] of M) {
    const row = await p.sysOperation.upsert({
      where: { code },
      update: { name, module, group, isActive: true },
      create: { code, name, module, group, isActive: true },
    });
    opIdByCode[code] = row.id;
  }
  console.log('operations count:', Object.keys(opIdByCode).length);

  // 角色默认操作模板（系统管理短码 + 业务全码）
  const allCodes = Object.keys(opIdByCode);
  // 业务码前缀集合（与 @Permissions 后续在业务 controller 加守卫时保持一致）
  const BIZ_PREFIXES = ['crm:', 'contract:', 'quotation:', 'worklog:', 'upload:', 'dashboard:'];
  const isBiz = (c) => BIZ_PREFIXES.some((p) => c.startsWith(p));
  const businessCodes = codesOf(isBiz);

  const roleTemplate = {
    admin: allCodes,
    leader: allCodes,
    sales: [...businessCodes, 'company:view', 'company:update'],
    purchase: [...codesOf((c) => isBiz(c) && (c.startsWith('contract:') || c.startsWith('quotation:') || c.startsWith('crm:customer:') || c === 'upload:view' || c === 'upload:create' || c === 'dashboard:view')), 'company:view', 'company:update'],
    business: [...codesOf((c) => isBiz(c) && (c.startsWith('contract:') || c.startsWith('quotation:') || c === 'upload:view' || c === 'dashboard:view')), 'company:view', 'company:update'],
    administrative: ['menu:view', ...codesOf((c) => isBiz(c) && (c.startsWith('contract:') || c.startsWith('quotation:') || c.startsWith('crm:customer:') || c === 'upload:view' || c === 'dashboard:view')), 'company:view', 'company:update'],
  };

  for (const [code, codes] of Object.entries(roleTemplate)) {
    const roleId = roleIds[code];
    const opIds = codes.map((c) => opIdByCode[c]).filter(Boolean);
    await p.sysRoleOperation.deleteMany({ where: { roleId } });
    if (opIds.length) {
      await p.sysRoleOperation.createMany({ data: opIds.map((operationId) => ({ roleId, operationId })) });
    }
    console.log(`role ${code}: ${opIds.length} ops`);
  }

  // admin 用户修正：isAdmin=true + 绑定 admin 角色
  const adminUser = await p.sysUser.findFirst({ where: { username: 'admin' } });
  if (adminUser) {
    await p.sysUser.update({ where: { id: adminUser.id }, data: { isAdmin: true } });
    await p.sysUserRole.deleteMany({ where: { userId: adminUser.id, roleId: roleIds.admin } });
    await p.sysUserRole.create({ data: { userId: adminUser.id, roleId: roleIds.admin } });
    console.log('admin user fixed: isAdmin=true, role=admin');
  } else {
    console.log('WARN: admin user not found');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
