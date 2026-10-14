// 模拟 Form.vue save + service update 实际流程
import { PrismaClient } from '@prisma/client';

const NESTED = { CrmCustomer: { contacts: 'CrmContact' } };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeDates(v) {
  if (Array.isArray(v)) return v.map(normalizeDates);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = normalizeDates(v[k]);
    return out;
  }
  if (typeof v === 'string' && DATE_RE.test(v)) return v + 'T00:00:00.000Z';
  return v;
}

const prisma = new PrismaClient();

async function main() {
  const d = await prisma.crmCustomer.findUnique({
    where: { id: 674 },
    include: {
      contacts: true,
      follows: { include: { follower: { select: { id: true, name: true } } } },
      inherits: { orderBy: { inheritedAt: 'desc' } },
    },
  });
  console.log('d keys:', Object.keys(d).slice(0, 30).join(', '));

  // 模拟 Form.vue loadDetail 后的 form（含 d 所有字段）
  const form = {
    name: d.name, code: d.code, pinyin: d.pinyin, shortName: d.shortName,
    type: d.type, category: d.category, followStage: d.followStage, source: d.source,
    industry: d.industry, valueRating: d.valueRating, creditLevel: d.creditLevel,
    currencyCode: d.currencyCode, paymentLimitPct: d.paymentLimitPct, address: d.address,
    zipcode: d.zipcode, legalPerson: d.legalPerson, registeredCapital: d.registeredCapital,
    park: d.park, intro: d.intro, cooperationStatus: d.cooperationStatus, prospect: d.prospect,
    strategy: d.strategy, taxId: d.taxId, invoiceTitle: d.invoiceTitle,
    invoiceBank: d.invoiceBank, invoiceBankAccount: d.invoiceBankAccount,
    bankName: d.bankName, accountName: d.accountName, bankCode: d.bankCode,
    bankAccount: d.bankAccount, bankAddress: d.bankAddress, bankPhone: d.bankPhone,
    paymentDays: d.paymentDays, settleDay: d.settleDay, ownerId: d.ownerId, deptId: d.deptId,
    sharedUserIds: d.sharedUserIds, attachments: d.attachments, remark: d.remark,
    isActive: d.isActive, region: d.region, stateId: d.stateId, cityId: d.cityId, districtId: d.districtId,
    submitStatus: 'draft',
    // d 的额外字段（Object.assign 会加进来）
    id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, createdById: d.createdById,
    updatedById: d.updatedById, follows: d.follows, inherits: d.inherits,
    owner: d.owner, dept: d.dept, createdBy: d.createdBy, updatedBy: d.updatedBy,
    contacts: d.contacts,
  };

  // 模拟 save: payload = { ...form }
  const payload = { ...form };

  console.log('\nPayload keys count:', Object.keys(payload).length);
  console.log('follows length:', payload.follows?.length);
  console.log('inherits length:', payload.inherits?.length);
  console.log('contacts length:', payload.contacts?.length);

  // inline scrub - Prisma 5.x 默认不暴露 ScalarFieldEnum 到 runtime
  // (Prisma.CrmCustomerScalarFieldEnum 是 undefined)
  // 所以 scrub 内部 `if (!flds) return body;` 会 return body 原样
  let body = payload;
  body = normalizeDates(body);
  const { contacts, ...rest } = body;
  const data = { ...rest, updatedById: 1 };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) {
    delete data[k];
  }

  console.log('\ndata keys count:', Object.keys(data).length);
  console.log('data.follows?', data.follows, 'data.inherits?', data.inherits);
  console.log('data.id?', data.id, 'data.createdAt?', data.createdAt);

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
    console.log('  ERR:', e.message?.slice(0, 800));
  }
}

main()
  .catch((e) => console.log('主错误:', e.message?.slice(0, 200)))
  .finally(() => prisma.$disconnect());
