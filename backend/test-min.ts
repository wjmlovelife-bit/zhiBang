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
  // 1. 仅 contacts.create = []
  await tryUpdate('contacts.create=[]', { contacts: { create: [] } });

  // 2. 仅 contacts
  await tryUpdate('contacts={}', { contacts: {} });

  // 3. 多个字段一起（不带 contacts）
  await tryUpdate('name+remark+attachments', {
    name: 'test',
    remark: 'r',
    attachments: [{ url: 'x', name: 'y' }],
  });

  // 4. 加 contacts.create=[]
  await tryUpdate('name+contacts.create=[]', { name: 'test', contacts: { create: [] } });

  // 5. 加 attachments
  await tryUpdate('name+contacts.create=[]+attachments', {
    name: 'test',
    contacts: { create: [] },
    attachments: [{ url: 'x', name: 'y' }],
  });
}

main().finally(() => prisma.$disconnect());
