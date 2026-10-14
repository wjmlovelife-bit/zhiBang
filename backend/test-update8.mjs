// 二分法找 Unknown argument 触发字段
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

async function tryUpdate(label, data) {
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 674 }, data });
    console.log(`${label}: OK`);
  } catch (e) {
    const lines = e.message.split('\n');
    const reason = lines.find((l) => l.includes('Unknown') || l.includes('Argument') || l.includes('prisma'));
    console.log(`${label}: ERR - ${reason?.slice(0, 200)}`);
  }
}

async function main() {
  const d = await prisma.crmCustomer.findUnique({ where: { id: 674 } });
  const base = { name: d.name, code: d.code, ownerId: d.ownerId, deptId: d.deptId };
  // 一组: 加上所有 ScalarField
  const fullFields = {
    ...base,
    pinyin: d.pinyin, shortName: d.shortName, type: d.type, category: d.category,
    followStage: d.followStage, source: d.source, industry: d.industry,
    valueRating: d.valueRating, creditLevel: d.creditLevel, currencyCode: d.currencyCode,
    paymentLimitPct: d.paymentLimitPct, address: d.address, zipcode: d.zipcode,
    legalPerson: d.legalPerson, registeredCapital: d.registeredCapital, park: d.park,
    intro: d.intro, cooperationStatus: d.cooperationStatus, prospect: d.prospect,
    strategy: d.strategy, taxId: d.taxId, invoiceTitle: d.invoiceTitle,
    invoiceBank: d.invoiceBank, invoiceBankAccount: d.invoiceBankAccount,
    bankName: d.bankName, accountName: d.accountName, bankCode: d.bankCode,
    bankAccount: d.bankAccount, bankAddress: d.bankAddress, bankPhone: d.bankPhone,
    paymentDays: d.paymentDays, settleDay: d.settleDay, sharedUserIds: d.sharedUserIds,
    attachments: d.attachments, remark: d.remark, isActive: d.isActive, region: d.region,
    stateId: d.stateId, cityId: d.cityId, districtId: d.districtId,
    submitStatus: d.submitStatus, id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt,
    createdById: d.createdById, updatedById: d.updatedById,
  };
  // base (4 字段) 应该 OK
  await tryUpdate('base 4 fields', base);
  // 加上 5 个 String 字段
  await tryUpdate('base + 5 strings', { ...base, pinyin: d.pinyin, shortName: d.shortName, type: d.type, category: d.category, followStage: d.followStage });
  // 加到 15 字段
  await tryUpdate('15 fields', { ...base, pinyin: d.pinyin, shortName: d.shortName, type: d.type, category: d.category, followStage: d.followStage, source: d.source, industry: d.industry, valueRating: d.valueRating, creditLevel: d.creditLevel, currencyCode: d.currencyCode });
  // 加到 25
  await tryUpdate('25 fields', { ...base, pinyin: d.pinyin, shortName: d.shortName, type: d.type, category: d.category, followStage: d.followStage, source: d.source, industry: d.industry, valueRating: d.valueRating, creditLevel: d.creditLevel, currencyCode: d.currencyCode, paymentLimitPct: d.paymentLimitPct, address: d.address, zipcode: d.zipcode, legalPerson: d.legalPerson, registeredCapital: d.registeredCapital, park: d.park, intro: d.intro, cooperationStatus: d.cooperationStatus, prospect: d.prospect, strategy: d.strategy, taxId: d.taxId });
  // 加到 35
  await tryUpdate('35 fields', { ...base, pinyin: d.pinyin, shortName: d.shortName, type: d.type, category: d.category, followStage: d.followStage, source: d.source, industry: d.industry, valueRating: d.valueRating, creditLevel: d.creditLevel, currencyCode: d.currencyCode, paymentLimitPct: d.paymentLimitPct, address: d.address, zipcode: d.zipcode, legalPerson: d.legalPerson, registeredCapital: d.registeredCapital, park: d.park, intro: d.intro, cooperationStatus: d.cooperationStatus, prospect: d.prospect, strategy: d.strategy, taxId: d.invoiceTitle, invoiceBank: d.invoiceBank, invoiceBankAccount: d.invoiceBankAccount, bankName: d.bankName, accountName: d.accountName, bankCode: d.bankCode, bankAccount: d.bankAccount, bankAddress: d.bankAddress, bankPhone: d.bankPhone, paymentDays: d.paymentDays, settleDay: d.settleDay });
  // 完整 50 字段
  await tryUpdate('50 fields', fullFields);
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
