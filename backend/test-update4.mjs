// 跑 test-update2 但捕获完整错误
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
    include: { contacts: true, follows: { include: { follower: { select: { id: true, name: true } } } }, inherits: { orderBy: { inheritedAt: 'desc' } } },
  });
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
    id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, createdById: d.createdById,
    updatedById: d.updatedById, follows: d.follows, inherits: d.inherits,
    owner: d.owner, dept: d.dept, createdBy: d.createdBy, updatedBy: d.updatedBy,
    contacts: d.contacts,
  };
  const payload = { ...form };
  let body = payload;
  body = normalizeDates(body);
  const { contacts, ...rest } = body;
  const data = { ...rest, updatedById: 1 };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) {
    delete data[k];
  }

  // 列出 data 中所有字段
  console.log('data keys:');
  for (const k of Object.keys(data).sort()) {
    const v = data[k];
    const type = Array.isArray(v) ? `array[${v.length}]` : typeof v;
    console.log(`  ${k}: ${type}`);
  }

  // 用 prisma 调 update
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
    console.log('OK, update 成功');
  } catch (e) {
    console.log('完整错误信息:');
    console.log(e.message);
  }
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
