// 最小化测试 — 找到具体哪个字段报错
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tryUpdate(label, extraData) {
  console.log(`\n=== 测试: ${label} ===`);
  try {
    const r = await prisma.crmCustomer.update({
      where: { id: 674 },
      data: { name: '测试不要紧', ...extraData },
    });
    console.log('  OK');
  } catch (e) {
    const msg = e.message?.split('\n').find((l) => l.includes('Field') || l.includes('Unknown') || l.includes('Argument') || l.includes('prisma')) || e.message;
    console.log('  ERR:', msg?.slice(0, 200));
  }
}

async function main() {
  const d = await prisma.crmCustomer.findUnique({ where: { id: 674 } });
  console.log('客户 674 实际数据:');
  console.log('  attachments:', JSON.stringify(d?.attachments).slice(0, 80));
  console.log('  contacts 数量: 0');

  // 测试 1: 仅附件
  await tryUpdate('attachments 字段', { attachments: d.attachments });

  // 测试 2: 附件 + id
  await tryUpdate('attachments + id', { attachments: d.attachments, id: 674 });

  // 测试 3: 附件 + createdAt
  await tryUpdate('attachments + createdAt', { attachments: d.attachments, createdAt: d.createdAt });

  // 测试 4: 附件 + updatedAt
  await tryUpdate('attachments + updatedAt', { attachments: d.attachments, updatedAt: new Date() });

  // 测试 5: 附件 + isActive
  await tryUpdate('attachments + isActive', { attachments: d.attachments, isActive: true });

  // 测试 6: 附件 + createdById
  await tryUpdate('attachments + createdById', { attachments: d.attachments, createdById: 1 });

  // 测试 7: 附件 + region
  await tryUpdate('attachments + region', { attachments: d.attachments, region: d.region });

  // 测试 8: 附件 + isPrimary (scalar field 不属于)
  await tryUpdate('attachments + isPrimary (错的字段)', { attachments: d.attachments, isPrimary: true });

  // 测试 9: 附件 + follows: [] (空数组)
  await tryUpdate('attachments + follows 空数组', { attachments: d.attachments, follows: [] });

  // 测试 10: 附件 + follows: [...] (有数据)
  const dFollows = await prisma.crmCustomer.findUnique({ where: { id: 674 }, include: { follows: true } });
  await tryUpdate('attachments + follows 有数据', { attachments: d.attachments, follows: dFollows.follows });

  // 测试 11: 附件 + inherits: [] 空
  await tryUpdate('attachments + inherits 空', { attachments: d.attachments, inherits: [] });

  // 测试 12: 附件 + owner: {}
  await tryUpdate('attachments + owner 空', { attachments: d.attachments, owner: {} });

  // 测试 13: 附件 + owner: 实际对象
  await tryUpdate('attachments + owner 对象', { attachments: d.attachments, owner: { id: 1, name: 'admin' } });
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
