// 把每个非管理员用户的角色操作模板（SysRoleOperation）复制到用户级授权（SysUserOperation）
// 用途：computePermissions 只查 SysUserOperation 不回退角色模板，所以非 admin 用户必须显式应用模板才能拿到 v-perm 码。
// 仅同步 SysUserOperation，不动 SysUserMenu（菜单权限有回退且 admin 可能手动配过）。
// 幂等：重复运行结果一致。
// 运行：node backend/prisma/apply-role-templates.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // 只处理 isAdmin=false 的用户；admin 走 computePermissions 的管理员分支自动拿到所有 operation
  const users = await p.sysUser.findMany({
    where: { isActive: true, isAdmin: false },
    include: { roles: { select: { roleId: true } } },
    orderBy: { id: 'asc' },
  });
  console.log('共 ' + users.length + ' 个非管理员用户需处理');

  for (const u of users) {
    const roleIds = u.roles.map((r) => r.roleId);
    if (!roleIds.length) {
      console.log('- id=' + u.id + ' ' + u.username + ' 无角色，跳过');
      continue;
    }
    // 收集该用户所有角色的操作码并集
    const roleOps = await p.sysRoleOperation.findMany({
      where: { roleId: { in: roleIds } },
      include: { operation: { select: { id: true, code: true, isActive: true } } },
    });
    const seen = new Set();
    const opIds = [];
    for (const ro of roleOps) {
      if (!ro.operation || !ro.operation.isActive) continue;
      const id = ro.operation.id;
      if (seen.has(id)) continue;
      seen.add(id);
      opIds.push(id);
    }
    await p.$transaction([
      p.sysUserOperation.deleteMany({ where: { userId: u.id } }),
      ...(opIds.length ? [p.sysUserOperation.createMany({ data: opIds.map((operationId) => ({ userId: u.id, operationId })) })] : []),
    ]);
    console.log('✓ id=' + u.id + ' ' + u.username + ' roles=[' + u.roles.map((r) => r.roleId).join(',') + '] → SysUserOperation=' + opIds.length + ' 项');
  }
  console.log('完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
