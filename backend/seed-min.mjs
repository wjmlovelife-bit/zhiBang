import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  // 部门
  let dept = await prisma.sysDept.findFirst({ where: { name: '总公司' } });
  if (!dept) dept = await prisma.sysDept.create({ data: { name: '总公司', code: 'HQ', sort: 0 } });
  let salesDept = await prisma.sysDept.findFirst({ where: { name: '销售部' } });
  if (!salesDept) salesDept = await prisma.sysDept.create({ data: { name: '销售部', code: 'SALES', parentId: dept.id, sort: 1 } });

  // 角色
  const adminRole = await prisma.sysRole.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: '超级管理员', dataScope: 1 },
  });
  const salesRole = await prisma.sysRole.upsert({
    where: { code: 'sales' },
    update: {},
    create: { code: 'sales', name: '销售员', dataScope: 4 },
  });

  // 用户（密码按明文存储；若登录逻辑用 bcrypt 需改为对应哈希）
  const admin = await prisma.sysUser.upsert({
    where: { username: 'admin' },
    update: { deptId: dept.id },
    create: { username: 'admin', password: '123456', name: '管理员', deptId: dept.id, isActive: true },
  });
  const sales01 = await prisma.sysUser.upsert({
    where: { username: 'sales01' },
    update: { deptId: salesDept.id },
    create: { username: 'sales01', password: '123456', name: '张三', deptId: salesDept.id, isActive: true },
  });

  // 用户-角色
  await prisma.sysUserRole.deleteMany({ where: { OR: [{ userId: admin.id }, { userId: sales01.id }] } });
  await prisma.sysUserRole.createMany({ data: [
    { userId: admin.id, roleId: adminRole.id },
    { userId: sales01.id, roleId: salesRole.id },
  ] });

  // 字典
  const dicts = [
    ['project_category', ['系统集成', '电磁兼容', '仪表销售', '仪器租赁', '代客户购', '过单转售']],
    ['project_stage', ['初期沟通', '立项评估', '方案制定', '招投标', '商务谈判', '合同签订', '长期合作']],
    ['project_source', ['电话咨询', '客户介绍', '独立开发', '展会活动', '公司分派']],
    ['project_state', ['成功', '失败', '延误', '跟踪', '初期跟进']],
    ['currency', ['人民币', '美元', '欧元', '日元', '英镑', '港币', '其他']],
  ];
  for (const [type, labels] of dicts) {
    await prisma.sysDict.deleteMany({ where: { type } });
    await prisma.sysDict.createMany({
      data: labels.map((label, i) => ({ type, label, value: label, sort: i + 1, isActive: true })),
    });
  }

  // 菜单：销售管理 -> 客户 / 项目 / 报价 / 合同
  await prisma.sysRoleMenu.deleteMany({});
  await prisma.sysMenu.deleteMany({ where: { name: '销售管理' } });
  const salesMenu = await prisma.sysMenu.create({
    data: { name: '销售管理', type: 'menu', sort: 1 },
  });
  const subMenus = [
    { name: '客户', path: '/sales/customer', component: 'sales/customer/list', sort: 1 },
    { name: '项目', path: '/sales/project', component: 'sales/project/list', sort: 2 },
    { name: '报价', path: '/sales/quotation', component: 'sales/quotation/list', sort: 3 },
    { name: '合同', path: '/sales/contract', component: 'sales/contract/list', sort: 4 },
    { name: '日志列表', path: '/sales/worklog', component: 'sales/worklog/list', sort: 5 },
    { name: '日志添加', path: '/sales/worklog/new', component: 'sales/worklog/form', sort: 6 },
  ];
  const createdMenus = [];
  for (const s of subMenus) {
    createdMenus.push(await prisma.sysMenu.create({
      data: { name: s.name, type: 'menu', path: s.path, component: s.component, parentId: salesMenu.id, sort: s.sort },
    }));
  }
  const roleMenuData = [];
  for (const role of [adminRole, salesRole]) {
    roleMenuData.push({ roleId: role.id, menuId: salesMenu.id });
    for (const m of createdMenus) roleMenuData.push({ roleId: role.id, menuId: m.id });
  }
  await prisma.sysRoleMenu.createMany({ data: roleMenuData });

  // 行政区划（中国省/市/区三级，数据来自 china-area-data）
  await prisma.sysRegion.deleteMany({});
  const cadMod = await import('china-area-data');
  const pcaa = cadMod.default || {};
  const provinces = pcaa['86'] || {};
  for (const [pCode, pName] of Object.entries(provinces)) {
    const prov = await prisma.sysRegion.create({ data: { code: pCode, name: pName, level: 1, parentId: null } });
    for (const [cCode, cName] of Object.entries(pcaa[pCode] || {})) {
      const city = await prisma.sysRegion.create({ data: { code: cCode, name: cName, level: 2, parentId: prov.id } });
      for (const [dCode, dName] of Object.entries(pcaa[cCode] || {})) {
        await prisma.sysRegion.create({ data: { code: dCode, name: dName, level: 3, parentId: city.id } });
      }
    }
  }

  console.log('SEED OK: admin/123456, sales01/123456; 字典与销售管理(客户/项目/报价/合同/工作日志)菜单、中国省/市/区行政区划已写入');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
