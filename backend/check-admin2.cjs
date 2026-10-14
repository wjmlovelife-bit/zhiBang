const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 查所有 admin 可能的字段
  const users = await p.sysUser.findMany({
    where: { OR: [{ username: 'admin' }, { name: '管理员' }] },
    select: {
      id: true,
      username: true,
      name: true,
      password: true,
      isActive: true,
      isAdmin: true,
      deptId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  for (const u of users) {
    console.log('---');
    console.log('id:', u.id, 'username:', u.username, 'name:', u.name);
    console.log('  password (raw):', JSON.stringify(u.password));
    console.log('  password 长度:', String(u.password || '').length);
    console.log('  isActive:', u.isActive);
    console.log('  isAdmin:', u.isAdmin);
    console.log('  期望登录的明文 "112233" === u.password?', u.password === '112233');
  }

  // 顺便查 sales01 / jishu01 看看
  const others = await p.sysUser.findMany({
    where: { OR: [{ username: { in: ['sales01', 'jishu01', 'zhangwu04'] } }] },
    select: { id: true, username: true, name: true, password: true, isActive: true },
  });
  console.log('\n=== 其他可能用户 ===');
  for (const u of others) {
    console.log('  ', u.id, u.username, 'name=' + u.name, 'pwd=' + JSON.stringify(u.password), 'active=' + u.isActive);
  }
  await p.$disconnect();
})();