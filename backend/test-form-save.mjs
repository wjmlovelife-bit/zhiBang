// 模拟 user 浏览器中改 strategy 并保存的完整流程
const BASE = 'http://127.0.0.1:3001/api';
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

// 1. 登录 sales01
const lr = await fetch(BASE + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'sales01', password: '123456' }),
});
const token = (await lr.json()).token;

// 2. 拿客户 50 当前所有字段（模拟 Form.vue loadDetail）
const d = (await (await fetch(BASE + '/customer/50', { headers: { Authorization: 'Bearer ' + token } })).json());
console.log('=== 客户 50 当前状态 ===');
console.log('name:', d.name);
console.log('strategy:', d.strategy);
console.log('stateId:', d.stateId, '(type:', typeof d.stateId, ')');

// 3. 模拟 user 改 strategy 后提交（追加 "123"）
const newStrategy = (d.strategy || '') + '123';
console.log('\n=== 模拟前端提交 ===');
console.log('strategy 新值:', newStrategy);

const formPayload = {
  name: d.name, code: d.code, pinyin: d.pinyin, shortName: d.shortName,
  type: d.type, category: d.category, followStage: d.followStage, source: d.source,
  industry: d.industry, valueRating: d.valueRating, creditLevel: d.creditLevel,
  currencyCode: d.currencyCode, paymentLimitPct: d.paymentLimitPct,
  address: d.address, zipcode: d.zipcode, legalPerson: d.legalPerson,
  registeredCapital: d.registeredCapital, park: d.park,
  phone: d.phone, fax: d.fax, email: d.email, website: d.website,
  intro: d.intro, cooperationStatus: d.cooperationStatus, prospect: d.prospect,
  strategy: newStrategy,
  bankName: d.bankName, accountName: d.accountName, bankCode: d.bankCode,
  bankAccount: d.bankAccount, bankAddress: d.bankAddress, bankPhone: d.bankPhone,
  taxId: d.taxId, paymentDays: d.paymentDays, settleDay: d.settleDay,
  settleContact: d.settleContact, invoiceTitle: d.invoiceTitle,
  invoiceBank: d.invoiceBank, invoiceBankAccount: d.invoiceBankAccount,
  remark: d.remark,
  stateId: d.stateId, cityId: d.cityId, districtId: d.districtId,
  ownerId: d.ownerId, deptId: d.deptId, submitStatus: d.submitStatus,
  contacts: d.contacts || [],
};

const r = await fetch(BASE + '/customer/50', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(formPayload),
});
console.log('\n=== PUT 响应 ===');
console.log('状态:', r.status);
const result = await r.json();
console.log('updatedAt:', result.updatedAt);
console.log('strategy:', result.strategy);
if (result.message) console.log('message:', result.message);

// 4. 查 DB
const c = await p.crmCustomer.findUnique({ where: { id: 50 } });
console.log('\n=== DB 实际 ===');
console.log('updatedAt:', c.updatedAt);
console.log('strategy:', c.strategy);

await p.$disconnect();
