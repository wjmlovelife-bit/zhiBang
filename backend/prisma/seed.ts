/**
 * 智邦 CRM 种子数据（生成自 2026-09-23 生产 dump）
 *
 * 用途：
 *   1. 本地开发体验（避免每次手动建用户/部门/角色）
 *   2. 新开发者 onboarding
 *   3. 测试 demo 数据
 *
 * 密码：所有用户密码统一为 123456（与生产一致）。
 * bcrypt hash 在 seed 运行时动态生成（仅一次，约 200ms）。
 *
 * 使用：
 *   cd backend && npm run seed
 *
 * ⚠️ 警告：执行会先 DELETE 各表所有数据再 INSERT，仅用于本地/测试，**禁止生产环境跑**
 *
 * 🛡️ 多重生产保护（2026-09-23 事故后加）：
 *   1. NODE_ENV=production 时拒绝执行
 *   2. SEED_CONFIRM=YES 显式确认（防 ts-node 误跑）
 *   3. DATABASE_URL 含 prod/production 关键字时拒绝
 *   4. 必须 --force 参数
 *   事故复盘：incident_2026-09-23.md
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SEED_PASSWORD = '123456';

// 🛡️ 生产环境保护：检测到生产环境时立即拒绝
function checkProductionSafety() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || '';
  const seedConfirm = process.env.SEED_CONFIRM || '';
  const hasForceFlag = process.argv.includes('--force');

  // 1. NODE_ENV=production
  if (nodeEnv === 'production') {
    throw new Error(
      '🛑 [seed] 拒绝执行：NODE_ENV=production。\n' +
      '   本脚本会 DELETE 所有业务表数据，**禁止生产环境跑**。\n' +
      '   事故复盘：incident_2026-09-23.md',
    );
  }
  // 2. DATABASE_URL 含生产特征（zhibang 库名是生产；zhibang_seed_peek / zhibang_test 才是测试）
  if (/(^|[^_])zhibang([^-_]|$)/.test(dbUrl) && !/seed|test/.test(dbUrl)) {
    throw new Error(
      '🛑 [seed] 拒绝执行：DATABASE_URL 看起来指向生产 zhibang 库（无 seed/test 字样）。\n' +
      '   事故复盘：2026-09-23 用户在生产库误跑此脚本导致业务数据被清。\n' +
      '   如确认要跑生产，请设置 SEED_CONFIRM=YES 并加 --force 参数。',
    );
  }
  // 3. 必须显式确认
  if (seedConfirm !== 'YES' || !hasForceFlag) {
    throw new Error(
      '🛑 [seed] 需要显式确认 + --force 参数。\n' +
      '   正确调用：SEED_CONFIRM=YES npx ts-node prisma/seed.ts --force\n' +
      '   或：SEED_CONFIRM=YES npm run seed -- --force',
    );
  }
  console.log('[seed] 安全检查通过，开始执行...');
}

async function main() {
  checkProductionSafety();
  console.log('[seed] 哈希密码中（bcrypt rounds=10，仅一次）...');
  const pwdHash = await bcrypt.hash(SEED_PASSWORD, 10);
  console.log('[seed] 开始清空 + 重建基础数据...');

  // ⚠️ 先清空（按外键反向：被引用方最后删）
  // 业务表（依赖 SysUser/Customer）
  await prisma.crmOpportunity.deleteMany({});
  await prisma.crmCustomer.deleteMany({});
  await prisma.crmContact.deleteMany({});
  await prisma.crmCustomerFollow.deleteMany({});
  await prisma.crmCustomerInherit.deleteMany({});
  await prisma.crmProjectFollow.deleteMany({});
  await prisma.crmProjectInherit.deleteMany({});
  await prisma.crmProjectItem.deleteMany({});
  await prisma.crmOpportunityLine.deleteMany({});
  await prisma.crmOpportunityShare.deleteMany({});
  await prisma.crmSalesSchedule.deleteMany({});
  await prisma.crmWeekSummary.deleteMany({});
  await prisma.crmWeeklySchedule.deleteMany({});
  await prisma.crmWorkLog.deleteMany({});
  await prisma.crmDailyReport.deleteMany({});
  await prisma.salesContract.deleteMany({});
  await prisma.salesContractLine.deleteMany({});
  await prisma.salesContractPaymentPlan.deleteMany({});
  await prisma.salesQuotation.deleteMany({});
  await prisma.salesQuotationLine.deleteMany({});
  await prisma.bizInventory.deleteMany({});
  await prisma.bizPurchase.deleteMany({});
  // 业务附件
  await prisma.sysAttach.deleteMany({});
  await prisma.sysOperLog.deleteMany({});
  await prisma.sysLoginLog.deleteMany({});
  // 系统表（从叶子到根）
  await prisma.sysUserOperation.deleteMany({});
  await prisma.sysUserMenu.deleteMany({});
  await prisma.sysUserRole.deleteMany({});
  await prisma.sysRoleOperation.deleteMany({});
  await prisma.sysRoleMenu.deleteMany({});
  await prisma.sysUser.deleteMany({});
  await prisma.sysRegion.deleteMany({});
  await prisma.sysDict.deleteMany({});
  await prisma.sysOperation.deleteMany({});
  await prisma.sysMenu.deleteMany({});
  await prisma.sysRole.deleteMany({});
  await prisma.sysDept.deleteMany({});
  await prisma.sysCompany.deleteMany({});

  // SysUser (27 行)
  await prisma.sysUser.createMany({
    data: [
      [1, "admin", "管理员", null, null, 1, "t", null, "t", "f", "${pwdHash}"],
      [2, "sales01", "张三", null, null, 2, "t", null, "f", "f", "${pwdHash}"],
      [24, "leader01", "董谦", null, null, 1, "t", null, "t", "f", "${pwdHash}"],
      [25, "leader02", "谢冰芷", null, null, 1, "t", null, "t", "f", "${pwdHash}"],
      [29, "shangwu01", "赵六", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [30, "caigou01", "刘七", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [53, "sales02", "余林森", null, null, 5, "t", null, "f", "f", "${pwdHash}"],
      [57, "sales03", "张天昊", null, null, 5, "t", null, "f", "f", "${pwdHash}"],
      [58, "sales04", "赵建福", null, null, 5, "t", null, "f", "f", "${pwdHash}"],
      [59, "sales05", "黄玉杰", null, null, 6, "t", null, "f", "f", "${pwdHash}"],
      [60, "sales06", "向志鹏", null, null, 6, "t", null, "f", "f", "${pwdHash}"],
      [64, "sales07", "聂贤伟", null, null, 5, "t", null, "f", "f", "${pwdHash}"],
      [65, "administrative01", "刘鑫", null, null, 7, "t", null, "f", "f", "${pwdHash}"],
      [66, "administrative02", "张苗", null, null, 7, "t", null, "f", "f", "${pwdHash}"],
      [68, "administrative03", "李静静", null, null, 7, "t", null, "f", "f", "${pwdHash}"],
      [69, "leader04", "赵金芳", null, null, 7, "t", null, "t", "f", "${pwdHash}"],
      [71, "dianshang01", "薛星晨", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [72, "dianshang02", "杨旭杰", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [73, "dianshang03", "王世浩", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [74, "dianshang04", "王钊阳", null, null, 4, "t", null, "f", "f", "${pwdHash}"],
      [76, "sales08", "林绪科", null, null, 2, "t", null, "f", "f", "${pwdHash}"],
      [77, "sales09", "杨英龙", null, null, 2, "t", null, "f", "f", "${pwdHash}"],
      [78, "sales010", "张林", null, null, 2, "t", null, "f", "f", "${pwdHash}"],
      [79, "leader03", "王佳敏", null, null, 4, "t", null, "t", "f", "${pwdHash}"],
      [80, "sales11", "黄诚诚", null, null, 2, "t", null, "t", "f", "${pwdHash}"],
      [81, "jishu01", "刘德彬", null, null, 2, "t", null, "f", "f", "${pwdHash}"],
      [82, "jishu02", "王晋", null, null, 2, "t", null, "f", "f", "${pwdHash}"]
    ],
  });

  // SysDept (6 行)
  await prisma.sysDept.createMany({
    data: [
      [1, "HQ", "总公司", 0, 0, "t"],
      [2, "SALES", "销售部", 1, 1, "t"],
      [4, null, "商务部", 1, 1, "t"],
      [5, null, "成都分部", 2, 0, "t"],
      [6, null, "重庆分部", 2, 0, "t"],
      [7, null, "综合部", 1, 0, "t"]
    ],
  });

  // SysRole (6 行)
  await prisma.sysRole.createMany({
    data: [
      [1, "admin", "超级管理员", 1, "t", null, "t"],
      [2, "sales", "销售", 4, "t", null, "f"],
      [4, "leader", "领导", 1, "t", null, "f"],
      [6, "purchase", "采购", 4, "t", null, "f"],
      [7, "business", "商务", 4, "t", null, "f"],
      [8, "administrative", "行政", 4, "t", null, "f"]
    ],
  });

  // SysMenu (19 行)
  await prisma.sysMenu.createMany({
    data: [
      [22, null, "menu", "销售管理", null, null, null, null, 1, "t"],
      [23, 22, "menu", "客户", "/sales/customer", "sales/customer/list", null, null, 1, "t"],
      [24, 22, "menu", "项目", "/sales/project", "sales/project/list", null, null, 2, "t"],
      [25, 22, "menu", "报价", "/sales/quotation", "sales/quotation/list", null, null, 3, "t"],
      [26, 22, "menu", "合同", "/sales/contract", "sales/contract/list", null, null, 4, "t"],
      [27, 22, "menu", "日志列表", "/sales/worklog", "sales/worklog/list", null, null, 5, "t"],
      [29, 100, "menu", "公司信息", "/system/company", "views/system/company/Info.vue", "OfficeBuilding", "company:view", 5, "t"],
      [30, null, "menu", "商务管理", null, null, null, null, 2, "t"],
      [31, 30, "menu", "采购", "/biz/purchase", "biz/purchase/list", null, null, 1, "t"],
      [32, 30, "menu", "库存", "/biz/inventory", "biz/inventory/list", null, null, 0, "t"],
      [33, 34, "menu", "非销售日程管理", "/sales/weekly-schedule", "sales/weekly-schedule/index", null, null, 50, "t"],
      [34, null, "menu", "日程管理", "/schedule", "Layout", null, null, 50, "t"],
      [35, 34, "menu", "销售日程管理", "/sales/sales-schedule", "sales/sales-schedule/index", null, null, 1, "t"],
      [100, null, "menu", "系统管理", null, null, null, null, 90, "t"],
      [101, 100, "menu", "用户管理", "/system/user", null, null, null, 1, "t"],
      [102, 100, "menu", "角色管理", "/system/role", null, null, null, 2, "t"],
      [103, 100, "menu", "部门管理", "/system/dept", null, null, null, 3, "t"],
      [104, 100, "menu", "菜单管理", "/system/menu", null, null, null, 4, "t"],
      [105, 100, "menu", "操作权限", "/system/operation", null, null, null, 5, "t"]
    ],
  });

  // SysOperation (59 行)
  await prisma.sysOperation.createMany({
    data: [
      [242, 0, "dept:manage", "部门管理(增删改)", "部门", 0, "t", "系统"],
      [243, 0, "menu:view", "查看菜单", "菜单", 0, "t", "系统"],
      [244, 0, "operation:view", "查看操作", "操作", 0, "t", "系统"],
      [245, 0, "operation:create", "新建操作", "操作", 0, "t", "系统"],
      [246, 0, "operation:update", "编辑操作", "操作", 0, "t", "系统"],
      [247, 0, "operation:delete", "删除操作", "操作", 0, "t", "系统"],
      [248, 0, "role:view", "查看角色", "角色", 0, "t", "系统"],
      [249, 0, "role:create", "新建角色", "角色", 0, "t", "系统"],
      [250, 0, "role:update", "编辑角色", "角色", 0, "t", "系统"],
      [251, 0, "role:delete", "删除角色", "角色", 0, "t", "系统"],
      [252, 0, "role:assign", "角色分配", "角色", 0, "t", "系统"],
      [253, 0, "user:view", "查看用户", "用户", 0, "t", "系统"],
      [254, 0, "user:create", "新建用户", "用户", 0, "t", "系统"],
      [255, 0, "user:update", "编辑用户", "用户", 0, "t", "系统"],
      [256, 0, "user:delete", "删除用户", "用户", 0, "t", "系统"],
      [257, 0, "user:assign", "用户授权", "用户", 0, "t", "系统"],
      [258, 0, "user:import", "导入用户", "用户", 0, "t", "系统"],
      [259, 0, "crm:customer:view", "查看客户", "客户", 0, "t", "客户"],
      [260, 0, "crm:customer:create", "新建客户", "客户", 0, "t", "客户"],
      [261, 0, "crm:customer:update", "编辑客户", "客户", 0, "t", "客户"],
      [262, 0, "crm:customer:delete", "删除客户", "客户", 0, "t", "客户"],
      [263, 0, "crm:customer:import", "导入客户", "客户", 0, "t", "客户"],
      [264, 0, "crm:customer:export", "导出客户", "客户", 0, "t", "客户"],
      [265, 0, "crm:project:view", "查看项目", "项目", 0, "t", "客户"],
      [266, 0, "crm:project:create", "新建项目", "项目", 0, "t", "客户"],
      [267, 0, "crm:project:update", "编辑项目", "项目", 0, "t", "客户"],
      [268, 0, "crm:project:delete", "删除项目", "项目", 0, "t", "客户"],
      [269, 0, "crm:project:follow", "项目关注", "项目", 0, "t", "客户"],
      [270, 0, "crm:opportunity:view", "查看商机", "商机", 0, "t", "客户"],
      [271, 0, "crm:opportunity:create", "新建商机", "商机", 0, "t", "客户"],
      [272, 0, "crm:opportunity:update", "编辑商机", "商机", 0, "t", "客户"],
      [273, 0, "crm:opportunity:delete", "删除商机", "商机", 0, "t", "客户"],
      [274, 0, "contract:view", "查看合同", "合同", 0, "t", "销售"],
      [275, 0, "contract:create", "新建合同", "合同", 0, "t", "销售"],
      [276, 0, "contract:update", "编辑合同", "合同", 0, "t", "销售"],
      [277, 0, "contract:delete", "删除合同", "合同", 0, "t", "销售"],
      [278, 0, "quotation:view", "查看报价", "报价", 0, "t", "销售"],
      [279, 0, "quotation:create", "新建报价", "报价", 0, "t", "销售"],
      [280, 0, "quotation:update", "编辑报价", "报价", 0, "t", "销售"],
      [281, 0, "quotation:delete", "删除报价", "报价", 0, "t", "销售"],
      [282, 0, "worklog:view", "查看工作日志", "工作日志", 0, "t", "客户"],
      [283, 0, "worklog:create", "新建工作日志", "工作日志", 0, "t", "客户"],
      [284, 0, "worklog:update", "编辑工作日志", "工作日志", 0, "t", "客户"],
      [285, 0, "worklog:delete", "删除工作日志", "工作日志", 0, "t", "客户"],
      [286, 0, "upload:view", "查看附件", "文件", 0, "t", "通用"],
      [287, 0, "upload:create", "上传附件", "文件", 0, "t", "通用"],
      [288, 0, "dashboard:view", "查看仪表盘", "仪表盘", 0, "t", "通用"],
      [289, 0, "biz:inventory:view", "查看库存", null, 0, "t", "商务"],
      [290, 0, "biz:inventory:create", "新建库存", null, 0, "t", "商务"],
      [291, 0, "biz:inventory:update", "编辑库存", null, 0, "t", "商务"],
      [292, 0, "biz:inventory:delete", "删除库存", null, 0, "t", "商务"],
      [293, 0, "biz:inventory:import", "导入库存", null, 0, "t", "商务"],
      [294, 0, "biz:inventory:export", "导出库存", null, 0, "t", "商务"],
      [295, 0, "biz:purchase:view", "查看采购", null, 0, "t", "商务"],
      [296, 0, "biz:purchase:create", "新建采购", null, 0, "t", "商务"],
      [297, 0, "biz:purchase:update", "编辑采购", null, 0, "t", "商务"],
      [298, 0, "biz:purchase:delete", "删除采购", null, 0, "t", "商务"],
      [299, 0, "biz:purchase:import", "导入采购", null, 0, "t", "商务"],
      [300, 0, "biz:purchase:export", "导出采购", null, 0, "t", "商务"]
    ],
  });

  // SysRoleMenu (70 行)
  await prisma.sysRoleMenu.createMany({
    data: [
      [1, 22],
      [1, 23],
      [1, 24],
      [1, 25],
      [1, 26],
      [1, 27],
      [1, 29],
      [1, 30],
      [1, 31],
      [1, 32],
      [1, 100],
      [1, 101],
      [1, 102],
      [1, 103],
      [1, 104],
      [1, 105],
      [2, 22],
      [2, 23],
      [2, 24],
      [2, 25],
      [2, 26],
      [2, 27],
      [2, 35],
      [4, 22],
      [4, 23],
      [4, 24],
      [4, 25],
      [4, 26],
      [4, 27],
      [4, 29],
      [4, 30],
      [4, 31],
      [4, 32],
      [4, 33],
      [4, 100],
      [4, 101],
      [4, 102],
      [4, 103],
      [4, 104],
      [4, 105],
      [6, 22],
      [6, 23],
      [6, 24],
      [6, 25],
      [6, 26],
      [6, 27],
      [6, 29],
      [6, 30],
      [6, 31],
      [6, 32],
      [6, 33],
      [7, 22],
      [7, 23],
      [7, 24],
      [7, 25],
      [7, 26],
      [7, 27],
      [7, 29],
      [7, 30],
      [7, 31],
      [7, 32],
      [7, 33],
      [8, 22],
      [8, 23],
      [8, 24],
      [8, 25],
      [8, 26],
      [8, 27],
      [8, 29],
      [8, 33]
    ],
  });

  // SysRoleOperation (216 行)
  await prisma.sysRoleOperation.createMany({
    data: [
      [1, 242],
      [1, 243],
      [1, 244],
      [1, 245],
      [1, 246],
      [1, 247],
      [1, 248],
      [1, 249],
      [1, 250],
      [1, 251],
      [1, 252],
      [1, 253],
      [1, 254],
      [1, 255],
      [1, 256],
      [1, 257],
      [1, 258],
      [1, 259],
      [1, 260],
      [1, 261],
      [1, 262],
      [1, 263],
      [1, 264],
      [1, 265],
      [1, 266],
      [1, 267],
      [1, 268],
      [1, 269],
      [1, 270],
      [1, 271],
      [1, 272],
      [1, 273],
      [1, 274],
      [1, 275],
      [1, 276],
      [1, 277],
      [1, 278],
      [1, 279],
      [1, 280],
      [1, 281],
      [1, 282],
      [1, 283],
      [1, 284],
      [1, 285],
      [1, 286],
      [1, 287],
      [1, 288],
      [1, 289],
      [1, 290],
      [1, 291],
      [1, 292],
      [1, 293],
      [1, 294],
      [1, 295],
      [1, 296],
      [1, 297],
      [1, 298],
      [1, 299],
      [1, 300],
      [2, 259],
      [2, 260],
      [2, 261],
      [2, 262],
      [2, 263],
      [2, 264],
      [2, 265],
      [2, 266],
      [2, 267],
      [2, 268],
      [2, 269],
      [2, 270],
      [2, 271],
      [2, 272],
      [2, 273],
      [2, 274],
      [2, 275],
      [2, 276],
      [2, 277],
      [2, 278],
      [2, 279],
      [2, 280],
      [2, 281],
      [2, 282],
      [2, 283],
      [2, 284],
      [2, 285],
      [2, 286],
      [2, 287],
      [2, 288],
      [4, 242],
      [4, 243],
      [4, 244],
      [4, 245],
      [4, 246],
      [4, 247],
      [4, 248],
      [4, 249],
      [4, 250],
      [4, 251],
      [4, 252],
      [4, 253],
      [4, 254],
      [4, 255],
      [4, 256],
      [4, 257],
      [4, 258],
      [4, 259],
      [4, 260],
      [4, 261],
      [4, 262],
      [4, 263],
      [4, 264],
      [4, 265],
      [4, 266],
      [4, 267],
      [4, 268],
      [4, 269],
      [4, 270],
      [4, 271],
      [4, 272],
      [4, 273],
      [4, 274],
      [4, 275],
      [4, 276],
      [4, 277],
      [4, 278],
      [4, 279],
      [4, 280],
      [4, 281],
      [4, 282],
      [4, 283],
      [4, 284],
      [4, 285],
      [4, 286],
      [4, 287],
      [4, 288],
      [4, 289],
      [4, 290],
      [4, 291],
      [4, 292],
      [4, 293],
      [4, 294],
      [4, 295],
      [4, 296],
      [4, 297],
      [4, 298],
      [4, 299],
      [4, 300],
      [6, 259],
      [6, 260],
      [6, 261],
      [6, 262],
      [6, 263],
      [6, 264],
      [6, 274],
      [6, 275],
      [6, 276],
      [6, 277],
      [6, 278],
      [6, 279],
      [6, 280],
      [6, 281],
      [6, 286],
      [6, 287],
      [6, 288],
      [6, 289],
      [6, 290],
      [6, 291],
      [6, 292],
      [6, 293],
      [6, 294],
      [6, 295],
      [6, 296],
      [6, 297],
      [6, 298],
      [6, 299],
      [6, 300],
      [7, 274],
      [7, 275],
      [7, 276],
      [7, 277],
      [7, 278],
      [7, 279],
      [7, 280],
      [7, 281],
      [7, 286],
      [7, 288],
      [7, 289],
      [7, 290],
      [7, 291],
      [7, 292],
      [7, 293],
      [7, 294],
      [7, 295],
      [7, 296],
      [7, 297],
      [7, 298],
      [7, 299],
      [7, 300],
      [8, 243],
      [8, 259],
      [8, 260],
      [8, 261],
      [8, 262],
      [8, 263],
      [8, 264],
      [8, 274],
      [8, 275],
      [8, 276],
      [8, 277],
      [8, 278],
      [8, 279],
      [8, 280],
      [8, 281],
      [8, 286],
      [8, 288]
    ],
  });

  // SysUserRole (27 行)
  await prisma.sysUserRole.createMany({
    data: [
      [1, 1],
      [2, 2],
      [24, 4],
      [25, 4],
      [29, 7],
      [30, 6],
      [53, 2],
      [57, 2],
      [58, 2],
      [59, 2],
      [60, 2],
      [64, 2],
      [65, 8],
      [66, 8],
      [68, 8],
      [69, 4],
      [71, 2],
      [72, 2],
      [73, 2],
      [74, 2],
      [76, 2],
      [77, 2],
      [78, 2],
      [79, 4],
      [80, 2],
      [81, 7],
      [82, 7]
    ],
  });

  // SysUserMenu (30 行)
  await prisma.sysUserMenu.createMany({
    data: [
      [1, 22],
      [1, 23],
      [1, 24],
      [1, 25],
      [1, 26],
      [1, 27],
      [1, 29],
      [1, 100],
      [1, 101],
      [1, 102],
      [1, 103],
      [1, 104],
      [1, 105],
      [2, 22],
      [2, 23],
      [2, 24],
      [2, 25],
      [2, 26],
      [2, 27],
      [24, 22],
      [24, 23],
      [24, 24],
      [24, 25],
      [24, 26],
      [24, 27],
      [24, 29],
      [24, 101],
      [24, 102],
      [24, 103],
      [24, 105]
    ],
  });

  // SysUserOperation (145 行)
  await prisma.sysUserOperation.createMany({
    data: [
      [1, 242],
      [1, 243],
      [1, 244],
      [1, 245],
      [1, 246],
      [1, 247],
      [1, 248],
      [1, 249],
      [1, 250],
      [1, 251],
      [1, 252],
      [1, 253],
      [1, 254],
      [1, 255],
      [1, 256],
      [1, 257],
      [1, 258],
      [1, 259],
      [1, 260],
      [1, 261],
      [1, 262],
      [1, 263],
      [1, 264],
      [1, 265],
      [1, 266],
      [1, 267],
      [1, 268],
      [1, 269],
      [1, 270],
      [1, 271],
      [1, 272],
      [1, 273],
      [1, 274],
      [1, 275],
      [1, 276],
      [1, 277],
      [1, 278],
      [1, 279],
      [1, 280],
      [1, 281],
      [1, 282],
      [1, 283],
      [1, 284],
      [1, 285],
      [1, 286],
      [1, 287],
      [1, 288],
      [24, 242],
      [24, 243],
      [24, 244],
      [24, 245],
      [24, 246],
      [24, 247],
      [24, 248],
      [24, 249],
      [24, 250],
      [24, 251],
      [24, 252],
      [24, 253],
      [24, 254],
      [24, 255],
      [24, 256],
      [24, 257],
      [24, 258],
      [24, 259],
      [24, 260],
      [24, 261],
      [24, 262],
      [24, 263],
      [24, 264],
      [24, 265],
      [24, 266],
      [24, 267],
      [24, 268],
      [24, 269],
      [24, 270],
      [24, 271],
      [24, 272],
      [24, 273],
      [24, 274],
      [24, 275],
      [24, 276],
      [24, 277],
      [24, 278],
      [24, 279],
      [24, 280],
      [24, 281],
      [24, 282],
      [24, 283],
      [24, 284],
      [24, 285],
      [24, 286],
      [24, 287],
      [24, 288],
      [29, 274],
      [29, 275],
      [29, 276],
      [29, 277],
      [29, 278],
      [29, 279],
      [29, 280],
      [29, 281],
      [29, 286],
      [29, 288],
      [29, 289],
      [29, 290],
      [29, 291],
      [29, 292],
      [29, 293],
      [29, 294],
      [29, 295],
      [29, 296],
      [29, 297],
      [29, 298],
      [29, 299],
      [29, 300],
      [30, 259],
      [30, 260],
      [30, 261],
      [30, 262],
      [30, 263],
      [30, 264],
      [30, 274],
      [30, 275],
      [30, 276],
      [30, 277],
      [30, 278],
      [30, 279],
      [30, 280],
      [30, 281],
      [30, 286],
      [30, 287],
      [30, 288],
      [30, 289],
      [30, 290],
      [30, 291],
      [30, 292],
      [30, 293],
      [30, 294],
      [30, 295],
      [30, 296],
      [30, 297],
      [30, 298],
      [30, 299],
      [30, 300]
    ],
  });

  // SysDict (30 行)
  await prisma.sysDict.createMany({
    data: [
      ["currency", "港币", "港币", 6, "t"],
      ["currency", "美元", "美元", 2, "t"],
      ["currency", "欧元", "欧元", 3, "t"],
      ["currency", "其他", "其他", 7, "t"],
      ["currency", "人民币", "人民币", 1, "t"],
      ["currency", "日元", "日元", 4, "t"],
      ["currency", "英镑", "英镑", 5, "t"],
      ["project_category", "代客户购", "代客户购", 5, "t"],
      ["project_category", "电磁兼容", "电磁兼容", 2, "t"],
      ["project_category", "过单转售", "过单转售", 6, "t"],
      ["project_category", "系统集成", "系统集成", 1, "t"],
      ["project_category", "仪表销售", "仪表销售", 3, "t"],
      ["project_category", "仪器租赁", "仪器租赁", 4, "t"],
      ["project_source", "电话咨询", "电话咨询", 1, "t"],
      ["project_source", "独立开发", "独立开发", 3, "t"],
      ["project_source", "公司分派", "公司分派", 5, "t"],
      ["project_source", "客户介绍", "客户介绍", 2, "t"],
      ["project_source", "展会活动", "展会活动", 4, "t"],
      ["project_stage", "初期沟通", "初期沟通", 1, "t"],
      ["project_stage", "方案制定", "方案制定", 3, "t"],
      ["project_stage", "合同签订", "合同签订", 6, "t"],
      ["project_stage", "立项评估", "立项评估", 2, "t"],
      ["project_stage", "商务谈判", "商务谈判", 5, "t"],
      ["project_stage", "长期合作", "长期合作", 7, "t"],
      ["project_stage", "招投标", "招投标", 4, "t"],
      ["project_state", "成功", "成功", 1, "t"],
      ["project_state", "初期跟进", "初期跟进", 5, "t"],
      ["project_state", "跟踪", "跟踪", 4, "t"],
      ["project_state", "失败", "失败", 2, "t"],
      ["project_state", "延误", "延误", 3, "t"]
    ],
  });

  // SysRegion (5 行)
  await prisma.sysRegion.createMany({
    data: [
      [110000, "北京市", 1, 0],
      [120000, "天津市", 1, 0],
      [130000, "河北省", 1, 0],
      [140000, "山西省", 1, 0],
      [150000, "内蒙古自治区", 1, 0]
    ],
  });

  // CrmCustomer (10 行)
  await prisma.crmCustomer.createMany({
    data: [
      ["KH202609170001", "四川航天世源科技有限公司", "单位客户", "终端公司", "初期沟通", "公司分派", "电子制造", 53, 2],
      ["KH202609170002", "青祁厦门半导体有限公司", "单位客户", "终端公司", "初期沟通", null, "芯片制造", 53, 2],
      ["KH202609190001", "成都大汉微波技术有限公司", "单位客户", "终端公司", "初期沟通", null, "电子制造", 57, 5],
      ["KH202609190002", "万相科技", "单位客户", "终端公司", "初期沟通", null, "芯片制造", 57, 5],
      ["KH202609200001", "重庆集成汽车电子有限公司", "单位客户", "终端公司", "跟进中", "独立开发", "汽车电子", 59, 6],
      ["KH202609200002", "重庆航天火箭电子科技有限公司", "单位客户", "终端公司", "初期沟通", "独立开发", "科研院所", 59, 6],
      ["KH202609200003", "重庆美利信科技", "单位客户", "终端公司", "初期沟通", "独立开发", "汽车电子", 59, 6],
      ["KH202609210001", "重庆阿斯潘科技有限公司", "单位客户", "终端公司", "跟进中", "独立开发", "汽车电子", 60, 6],
      ["KH202609210002", "成都正扬博创电子技术股份有限公司", "单位客户", "终端公司", "初期沟通", "独立开发", "电子制造", 58, 5],
      ["KH202609210003", "成都金诺信高科技有限公司", "单位客户", "终端公司", "初期沟通", "独立开发", "电子制造", 58, 5]
    ],
  });

  // CrmOpportunity (4 行)
  await prisma.crmOpportunity.createMany({
    data: [
      ["XM202609170001", "航天世源科技+继电器", 799, "初期沟通", 53],
      ["XM202609200001", "重庆集成汽车有限公司信号发生器项目", 804, "初期沟通", 59],
      ["XM202609210001", "普源DS9000项目", 811, "初期沟通", 59],
      ["XM202609220001", "中微渝芯电子有限公司福禄克电池项目", 841, "初期沟通", 59]
    ],
  });

  console.log('[seed] 完成');
}

main()
  .catch((e) => {
    console.error('[seed] FAILED', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
