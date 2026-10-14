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
    console.log(label + ': ERR - ' + (reason || '').slice(0, 300));
  }
}

async function main() {
  const d: any = await prisma.crmCustomer.findUnique({ where: { id: 767 } });
  const form: any = {};
  Object.assign(form, d, { contacts: [] });
  form.name = 'AI测试新建客户（已编辑）';
  form.remark = '编辑后的备注';
  const payload: any = { ...form };

  // 模拟 service.update 处理
  let body = normalizeDates(scrub('CrmCustomer', payload));
  const { contacts, ...rest } = body;
  const data: any = { ...rest, updatedById: 1 };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) delete data[k];

  console.log('data keys:', Object.keys(data).length);
  console.log('data.attachments[0]:', JSON.stringify(data.attachments?.[0]));
  console.log('data.contacts?', data.contacts);
  console.log('data.createdAt:', data.createdAt, 'type:', typeof data.createdAt, 'isDate:', data.createdAt instanceof Date);
  console.log('data.updatedAt:', data.updatedAt, 'type:', typeof data.updatedAt, 'isDate:', data.updatedAt instanceof Date);

  // 1. 不带 contacts - 用 transaction
  try {
    const r = await prisma.$transaction(async (tx) => {
      const data2: any = { ...data };
      delete data2.contacts;
      return tx.crmCustomer.update({ where: { id: 767 }, data: data2 });
    });
    console.log('tx（无 contacts）: OK');
  } catch (e) {
    console.log('tx（无 contacts）ERR:', (e as any).message?.split('\n').find((l: string) => l.includes('serialize') || l.includes('Invalid'))?.slice(0, 200));
  }

  // 2. 不 scrub（直接用 d）
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 767 }, data: { name: 'test' } });
    console.log('只 name: OK');
  } catch (e) {
    console.log('只 name ERR:', (e as any).message);
  }

  // 3. 用 d 直接 update（不 scrub）
  const data3: any = { ...d };
  delete data3.owner; delete data3.dept; delete data3.createdBy; delete data3.updatedBy;
  delete data3.inherits; delete data3.follows; delete data3.opportunities;
  delete data3.contacts;
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 767 }, data: data3 });
    console.log('d 直接（无 scrub）: OK');
  } catch (e) {
    console.log('d 直接 ERR:', (e as any).message?.split('\n').find((l: string) => l.includes('serialize') || l.includes('Invalid'))?.slice(0, 200));
  }

  // 4. 用 scrub + d
  const data4: any = { ...normalizeDates(scrub('CrmCustomer', d)) };
  delete data4.owner; delete data4.dept; delete data4.createdBy; delete data4.updatedBy;
  delete data4.inherits; delete data4.follows; delete data4.opportunities;
  delete data4.contacts;
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 767 }, data: data4 });
    console.log('scrub d（无 contacts）: OK');
  } catch (e) {
    console.log('scrub d ERR:', (e as any).message?.split('\n').find((l: string) => l.includes('serialize') || l.includes('Invalid'))?.slice(0, 300));
  }
}

main().finally(() => prisma.$disconnect());
