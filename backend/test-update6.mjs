// 精确定位 Unknown argument 的原因
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function tryUpdate(label, data) {
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 674 }, data });
    console.log(`${label}: OK`);
  } catch (e) {
    const lines = e.message.split('\n');
    const reason = lines.find((l) => l.includes('Unknown') || l.includes('prisma'));
    console.log(`${label}: ERR - ${reason?.slice(0, 100) || 'unknown'}`);
  }
}

async function main() {
  // 单字段
  await tryUpdate('单字段 ownerId', { ownerId: 2 });

  // 2 字段
  await tryUpdate('2字段 ownerId+code', { ownerId: 2, code: 'test' });

  // 加 1 个 contacts create
  await tryUpdate('ownerId + contacts: {create: []}', { ownerId: 2, contacts: { create: [] } });

  // 加 attachments
  await tryUpdate('ownerId + attachments', { ownerId: 2, attachments: [] });

  // 加 id
  await tryUpdate('ownerId + id', { ownerId: 2, id: 674 });

  // 加 createdAt
  await tryUpdate('ownerId + createdAt', { ownerId: 2, createdAt: new Date() });

  // 加 updatedAt
  await tryUpdate('ownerId + updatedAt', { ownerId: 2, updatedAt: new Date() });

  // 加 isActive
  await tryUpdate('ownerId + isActive', { ownerId: 2, isActive: true });

  // 加 region
  await tryUpdate('ownerId + region', { ownerId: 2, region: [] });

  // 加 sharedUserIds
  await tryUpdate('ownerId + sharedUserIds', { ownerId: 2, sharedUserIds: [1, 2] });

  // 加 scale (schema 里有)
  await tryUpdate('ownerId + scale', { ownerId: 2, scale: 'S' });

  // 加 phone
  await tryUpdate('ownerId + phone', { ownerId: 2, phone: '13800000000' });

  // 加 fax
  await tryUpdate('ownerId + fax', { ownerId: 2, fax: '123' });

  // 加 email
  await tryUpdate('ownerId + email', { ownerId: 2, email: 'a@b.com' });

  // 加 website
  await tryUpdate('ownerId + website', { ownerId: 2, website: 'http://x.com' });

  // 加 legalPersonOld
  await tryUpdate('ownerId + legalPersonOld', { ownerId: 2, legalPersonOld: 'old' });

  // 加 settleContact
  await tryUpdate('ownerId + settleContact', { ownerId: 2, settleContact: '李四' });
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
