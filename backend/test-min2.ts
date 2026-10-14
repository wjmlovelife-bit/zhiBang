import { PrismaClient } from '@prisma/client';
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
  console.log('d keys:', Object.keys(d).length);

  // 1. 全字段（d 的所有字段） + contacts.create=[]
  const data: any = { ...d };
  delete data.owner; delete data.dept; delete data.createdBy; delete data.updatedBy;
  delete data.inherits; delete data.follows; delete data.opportunities;
  data.contacts = { create: [] };
  console.log('data keys:', Object.keys(data).length);
  await tryUpdate('d 全字段 + contacts.create=[]', data);

  // 2. 同样的 data 但去掉 contacts
  const data2 = { ...data };
  delete data2.contacts;
  await tryUpdate('d 全字段（无 contacts）', data2);
}

main().finally(() => prisma.$disconnect());
