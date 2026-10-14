import { PrismaClient } from '@prisma/client';
import { scrub, normalizeDates } from './src/common/utils/payload';
const prisma = new PrismaClient();

async function tryUpdate(label: string, data: any) {
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 767 }, data });
    console.log(label + ': OK');
  } catch (e) {
    const lines = (e as any).message.split('\n');
    const reason = lines.find((l: string) => l.includes('Invalid') || l.includes('prisma') || l.includes('serialize'));
    console.log(label + ': ERR - ' + (reason || '').slice(0, 200));
  }
}

async function main() {
  const d: any = await prisma.crmCustomer.findUnique({ where: { id: 767 } });
  const scrubbed = normalizeDates(scrub('CrmCustomer', d));
  const data: any = { ...scrubbed };
  // 删一些字段
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities', 'contacts']) delete data[k];

  // 单独测试可疑字段
  await tryUpdate('单独 createdAt (Date)', { createdAt: data.createdAt });
  await tryUpdate('单独 updatedAt (Date)', { updatedAt: data.updatedAt });
  await tryUpdate('单独 paymentLimitPct', { paymentLimitPct: data.paymentLimitPct });
  await tryUpdate('单独 registeredCapital', { registeredCapital: data.registeredCapital });
  await tryUpdate('单独 attachments', { attachments: data.attachments });
  await tryUpdate('单独 region', { region: data.region });
  await tryUpdate('单独 sharedUserIds', { sharedUserIds: data.sharedUserIds });
  await tryUpdate('单独 id', { id: data.id });
  await tryUpdate('单独 createdById', { createdById: data.createdById });
  await tryUpdate('单独 updatedById', { updatedById: data.updatedById });

  // 组合
  await tryUpdate('createdAt + updatedAt', { createdAt: data.createdAt, updatedAt: data.updatedAt });
  await tryUpdate('3 个时间字段', {
    createdAt: data.createdAt, updatedAt: data.updatedAt, createdById: data.createdById,
  });
  await tryUpdate('所有系统字段', {
    id: data.id, createdAt: data.createdAt, updatedAt: data.updatedAt,
    createdById: data.createdById, updatedById: data.updatedById,
  });
}
main().finally(() => prisma.$disconnect());
