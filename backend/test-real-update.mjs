// 用 ts-node 跑真实 service.update 流程
// 或者: 直接 import 真实 sanitize 函数
import { PrismaClient } from '@prisma/client';

// 直接 import TS 文件 - 用 tsx
import { sanitize } from './src/common/utils/payload.ts';
import { CustomerService } from './src/modules/customer/customer.service.ts';

const prisma = new PrismaClient();
const customerService = new CustomerService(prisma);

async function main() {
  // 模拟 Form.vue save 实际 payload
  const d = await prisma.crmCustomer.findUnique({
    where: { id: 674 },
    include: { contacts: true, follows: true, inherits: true, owner: true, dept: true },
  });

  // 模拟 loadDetail 后的 form（Object.assign 所有 d 字段 + contacts override）
  const form = {};
  Object.assign(form, d, { contacts: d.contacts || [] });

  // 模拟 save: payload = { ...form }
  const payload = { ...form };

  console.log('Payload 字段数:', Object.keys(payload).length);
  console.log('Payload has follows:', Array.isArray(payload.follows));
  console.log('Payload has inherits:', Array.isArray(payload.inherits));
  console.log('Payload has owner:', typeof payload.owner);
  console.log('Payload has createdAt:', !!payload.createdAt);
  console.log('Payload has updatedAt:', !!payload.updatedAt);

  // 模拟 service.update
  const user = { id: 1 };
  let body = sanitize('CrmCustomer', payload);
  const { contacts, ...rest } = body;
  const data = { ...rest, updatedById: user.id };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) {
    delete data[k];
  }

  console.log('\n[service.update 处理后 data]');
  console.log('data 字段数:', Object.keys(data).length);
  console.log('data.follows:', data.follows);
  console.log('data.inherits:', data.inherits);
  console.log('data.owner:', data.owner);
  console.log('data.id:', data.id);
  console.log('data.createdAt type:', typeof data.createdAt, 'isDate:', data.createdAt instanceof Date);

  // 跑 prisma
  try {
    const r = await prisma.$transaction(async (tx) => {
      if (Array.isArray(contacts)) {
        await tx.crmContact.deleteMany({ where: { customerId: 674 } });
        data.contacts = { create: contacts };
      }
      return tx.crmCustomer.update({ where: { id: 674 }, data, include: { contacts: true } });
    });
    console.log('OK');
  } catch (e) {
    console.log('ERR:', e.message?.slice(0, 1000));
  }
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
