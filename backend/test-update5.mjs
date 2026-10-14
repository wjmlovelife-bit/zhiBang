// 验证 ownerId update 行为
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function tryUpdate(label, data) {
  console.log(`\n=== ${label} ===`);
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 674 }, data });
    console.log('  OK');
  } catch (e) {
    const lines = e.message.split('\n');
    const reason = lines.find((l) => l.includes('Unknown') || l.includes('Argument') || l.includes('Field') || l.includes('prisma') || l.includes('Cannot')) || lines[0];
    console.log('  ERR:', reason?.slice(0, 200));
  }
}

async function main() {
  const d = await prisma.crmCustomer.findUnique({ where: { id: 674 } });
  console.log('当前 ownerId:', d?.ownerId, 'deptId:', d?.deptId);

  // 单独测试各个字段
  await tryUpdate('ownerId = 当前值', { ownerId: d.ownerId });
  await tryUpdate('ownerId = 2', { ownerId: 2 });
  await tryUpdate('deptId = 当前值', { deptId: d.deptId });
  await tryUpdate('createdById = 1', { createdById: 1 });
  await tryUpdate('updatedById = 1', { updatedById: 1 });
  await tryUpdate('sharedUserIds = []', { sharedUserIds: [] });
  await tryUpdate('sharedUserIds = [1,2]', { sharedUserIds: [1, 2] });
  await tryUpdate('owner: { connect: {id: ...} }', { owner: { connect: { id: d.ownerId } } });
  await tryUpdate('id = 674 (repeat)', { id: 674 });
  await tryUpdate('createdAt (Date)', { createdAt: new Date() });
  await tryUpdate('isActive', { isActive: true });
  await tryUpdate('region = [...]', { region: d.region });
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
