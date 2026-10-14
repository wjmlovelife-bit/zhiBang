import { PrismaClient } from '@prisma/client';
import { scrub, normalizeDates } from './src/common/utils/payload';

const prisma = new PrismaClient();

async function main() {
  const d = await prisma.crmCustomer.findUnique({
    where: { id: 767 },
    include: { contacts: true, follows: true, inherits: true },
  });
  console.log('contacts length:', d.contacts.length);
  console.log('contacts[0] keys:', Object.keys(d.contacts[0] || {}).join(', '));

  const form: any = {};
  Object.assign(form, d, { contacts: d.contacts || [] });
  form.name = 'AI测试新建客户（已编辑）';
  form.remark = '编辑后的备注';
  const payload: any = { ...form };

  let body = normalizeDates(scrub('CrmCustomer', payload));
  const { contacts, ...rest } = body;
  const data: any = { ...rest, updatedById: 1 };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) delete data[k];

  console.log('data.contacts?', data.contacts);
  console.log('contacts[0] id?', contacts?.[0]?.id, 'customerId?', contacts?.[0]?.customerId);

  try {
    const r = await prisma.$transaction(async (tx) => {
      if (Array.isArray(contacts)) {
        await tx.crmContact.deleteMany({ where: { customerId: 767 } });
        data.contacts = { create: contacts };
      }
      return tx.crmCustomer.update({ where: { id: 767 }, data, include: { contacts: true } });
    });
    console.log('OK');
  } catch (e) {
    console.log('=== FULL ERROR ===');
    console.log((e as any).message);
  }
}

main().finally(() => prisma.$disconnect());
