// 创建「公司信息」菜单并授权给所有角色（幂等）
// 运行：node backend/prisma/add-company-menu.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // 找“系统管理”父菜单（按名称模糊匹配），找不到则作为顶级菜单
  const allMenus = await p.sysMenu.findMany({});
  const parent = allMenus.find((m) => /系统管理/.test(m.name)) || null;

  // SysMenu 无唯一业务键，用 name+path 定位（先查后建/改）
  const found = await p.sysMenu.findFirst({ where: { name: '公司信息', path: '/system/company' } });
  let menuId;
  if (found) {
    menuId = found.id;
    await p.sysMenu.update({
      where: { id: menuId },
      data: {
        parentId: parent?.id ?? null,
        type: 'menu',
        component: 'views/system/company/Info.vue',
        icon: 'OfficeBuilding',
        permCode: 'company:view',
        sort: 5,
        isActive: true,
      },
    });
    console.log('菜单已存在，已更新（id=%d）', menuId);
  } else {
    const created = await p.sysMenu.create({
      data: {
        name: '公司信息',
        parentId: parent?.id ?? null,
        type: 'menu',
        path: '/system/company',
        component: 'views/system/company/Info.vue',
        icon: 'OfficeBuilding',
        permCode: 'company:view',
        sort: 5,
        isActive: true,
      },
    });
    menuId = created.id;
    console.log('菜单已创建（id=%d, parent=%s）', menuId, parent?.name || '顶级');
  }

  // 授权给所有角色（确保各角色在菜单管理里可见）
  const roles = await p.sysRole.findMany({});
  for (const r of roles) {
    const exist = await p.sysRoleMenu.findUnique({ where: { roleId_menuId: { roleId: r.id, menuId } } });
    if (!exist) {
      await p.sysRoleMenu.create({ data: { roleId: r.id, menuId } });
      console.log('已授权角色 %s 可见「公司信息」', r.code);
    }
  }
  console.log('完成：公司信息菜单已挂载到「%s」下并授权全部角色', parent?.name || '顶级');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
