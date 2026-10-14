import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 定位"日志添加"菜单：优先 id=28，或名称含"日志添加"
  const menu = await prisma.sysMenu.findFirst({
    where: { OR: [{ id: 28 }, { name: { contains: '日志添加' } }] },
  });
  if (!menu) {
    console.log('[skip] 未找到"日志添加"菜单，无需处理');
    return;
  }
  console.log(`[found] 菜单 id=${menu.id} name=${menu.name} parentId=${menu.parentId}`);

  // 同步清理：角色/用户菜单授权 + 挂载在该菜单下的操作权限码（避免孤儿权限残留）
  await prisma.sysRoleMenu.deleteMany({ where: { menuId: menu.id } });
  await prisma.sysUserMenu.deleteMany({ where: { menuId: menu.id } });
  const ops = await prisma.sysOperation.findMany({ where: { menuId: menu.id } });
  if (ops.length) await prisma.sysOperation.deleteMany({ where: { menuId: menu.id } });

  await prisma.sysMenu.delete({ where: { id: menu.id } });
  console.log(`[done] 已删除"日志添加"菜单(id=${menu.id})，级联删除操作码 ${ops.length} 个`);
}

main()
  .catch((e) => {
    console.error('[error]', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
