import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function tryCreate(label: string, data: any) {
  try {
    const r = await prisma.crmContact.create({ data });
    console.log(label + ': OK, id=' + r.id);
  } catch (e) {
    const lines = (e as any).message.split('\n');
    const reason = lines.find((l: string) => l.includes('Invalid') || l.includes('Argument') || l.includes('serialize'));
    console.log(label + ': ERR - ' + (reason || '').slice(0, 300));
  }
}

async function main() {
  // 1. 最小 create
  await tryCreate('最小字段', { name: 'test1', customerId: 767 });

  // 2. 带 id
  await tryCreate('带 id', { id: 999, name: 'test2', customerId: 767 });

  // 3. 带 createdAt
  await tryCreate('带 createdAt', { name: 'test3', customerId: 767, createdAt: new Date() });

  // 4. 带 sort
  await tryCreate('带 sort', { name: 'test4', customerId: 767, sort: 0 });

  // 5. 全字段（scrub 后的）
  await tryCreate('全字段（含 id+createdAt）', {
    id: 1000,
    customerId: 767,
    name: 'test5',
    gender: '男',
    department: '研发',
    position: '经理',
    officePhone: '010-12345678',
    fax: '010-87654321',
    mobile: '13800138000',
    wechat: 'test_wechat',
    email: 'a@b.com',
    isPrimary: false,
    remark: 'remark',
    sort: 0,
    createdAt: new Date(),
  });
}

main().finally(() => prisma.$disconnect());
