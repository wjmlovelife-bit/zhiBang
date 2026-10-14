// 模拟 Form.vue save 实际 payload，经过 service update 流程
import { PrismaClient } from '@prisma/client';
import { sanitize } from './src/common/utils/payload.ts';

const prisma = new PrismaClient();

async function main() {
  // 1. 模拟 detail 接口返回的 d
  const d = await prisma.crmCustomer.findUnique({
    where: { id: 674 },
    include: {
      contacts: true,
      follows: { include: { follower: { select: { id: true, name: true } } } },
      inherits: { orderBy: { inheritedAt: 'desc' } },
    },
  });
  console.log('d keys:', Object.keys(d).slice(0, 30).join(', '));

  // 2. 模拟 Form.vue Object.assign(form, d, { contacts: d.contacts || [] })
  //    然后 payload = { ...form }
  const payload = {
    name: d.name,
    code: d.code,
    pinyin: d.pinyin,
    shortName: d.shortName,
    type: d.type,
    category: d.category,
    followStage: d.followStage,
    source: d.source,
    industry: d.industry,
    valueRating: d.valueRating,
    creditLevel: d.creditLevel,
    currencyCode: d.currencyCode,
    paymentLimitPct: d.paymentLimitPct,
    address: d.address,
    zipcode: d.zipcode,
    legalPerson: d.legalPerson,
    registeredCapital: d.registeredCapital,
    park: d.park,
    intro: d.intro,
    cooperationStatus: d.cooperationStatus,
    prospect: d.prospect,
    strategy: d.strategy,
    taxId: d.taxId,
    invoiceTitle: d.invoiceTitle,
    invoiceBank: d.invoiceBank,
    invoiceBankAccount: d.invoiceBankAccount,
    bankName: d.bankName,
    accountName: d.accountName,
    bankCode: d.bankCode,
    bankAccount: d.bankAccount,
    bankAddress: d.bankAddress,
    bankPhone: d.bankPhone,
    paymentDays: d.paymentDays,
    settleDay: d.settleDay,
    ownerId: d.ownerId,
    deptId: d.deptId,
    sharedUserIds: d.sharedUserIds,
    attachments: d.attachments,
    remark: d.remark,
    isActive: d.isActive,
    region: d.region,
    stateId: d.stateId,
    cityId: d.cityId,
    districtId: d.districtId,
    submitStatus: 'draft',
    // 来自 d 的额外字段（Object.assign 会新增）
    id: d.id,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    createdById: d.createdById,
    updatedById: d.updatedById,
    follows: d.follows,  // 数组
    inherits: d.inherits,  // 数组
    owner: d.owner,  // 对象
    dept: d.dept,  // 对象
    createdBy: d.createdBy,
    updatedBy: d.updatedBy,
    // 联系人（覆盖）
    contacts: d.contacts,
  };

  console.log('\nPayload keys:', Object.keys(payload).length);
  console.log('follows type:', Array.isArray(payload.follows) ? 'array' : typeof payload.follows, 'length:', payload.follows?.length);
  console.log('inherits type:', Array.isArray(payload.inherits) ? 'array' : typeof payload.inherits, 'length:', payload.inherits?.length);

  // 3. 模拟 service.update
  const user = { id: 1 };  // 模拟 admin
  let body = sanitize('CrmCustomer', payload);
  const { contacts, ...rest } = body;
  const data = { ...rest, updatedById: user.id };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) {
    delete data[k];
  }

  console.log('\n处理后 data keys:', Object.keys(data).sort().join(', '));
  console.log('data.follows?', data.follows);
  console.log('data.inherits?', data.inherits);
  console.log('data.owner?', data.owner);
  console.log('data.id?', data.id);
  console.log('data.attachments type:', Array.isArray(data.attachments) ? 'array' : typeof data.attachments);

  // 4. 实际调 prisma update
  console.log('\n调 prisma update...');
  try {
    const r = await prisma.$transaction(async (tx) => {
      if (Array.isArray(contacts)) {
        await tx.crmContact.deleteMany({ where: { customerId: 674 } });
        data.contacts = { create: contacts };
      }
      return tx.crmCustomer.update({
        where: { id: 674 },
        data,
        include: { contacts: true },
      });
    });
    console.log('  OK, update 成功');
  } catch (e) {
    console.log('  ERR:', e.message?.slice(0, 500));
  }
}

main()
  .catch((e) => console.log('主错误:', e.message?.slice(0, 200)))
  .finally(() => prisma.$disconnect());
