import { req, login } from './lib/http.mjs';
const a = await login('admin', '123456');
const token = a.token;

const nc = await req('GET', '/contract/next-code', { token });
const c = await req('POST', '/contract', {
  token,
  body: { code: nc.data, title: 'dbg', customerName: 'x', signDate: '2026-08-27', currencyCode: '人民币', amountTotal: 1, lines: [{ productName: 'a', quantity: 1, unitPrice: 1 }], paymentPlans: [{ seq: 1, planDate: '2026-09-01', amount: 1 }] },
});
console.log('contract create', c.status, JSON.stringify(c.data).slice(0, 200));
const cid = c.data.id;
const up = await req('PUT', '/contract/' + cid, { token, body: { approvalState: 'submitted' } });
console.log('contract update', up.status, JSON.stringify(up.data).slice(0, 500));

const cnc = await req('GET', '/customer/next-code', { token });
const cu = await req('POST', '/customer', { token, body: { code: cnc.data, name: 'dbg', category: '终端公司', followStage: '高', industry: '电子', currencyCode: '人民币' } });
const cuid = cu.data.id;
const cup = await req('PUT', '/customer/' + cuid, { token, body: { bankAddress: 'a', bankPhone: 'b', settleDay: 15 } });
console.log('customer update(num)', cup.status, JSON.stringify(cup.data).slice(0, 500));
const cup2 = await req('PUT', '/customer/' + cuid, { token, body: { settleDay: '15' } });
console.log('customer update(str)', cup2.status, JSON.stringify(cup2.data).slice(0, 500));

const ip = await req('POST', '/project/import-preview', { token, body: { rows: [{ name: 'a', customerCode: 'KH', dateOpen: '2026-08-27', category: '系统集成', stage: '初期沟通', source: '电话咨询', state: '跟踪', ownerId: 1 }] } });
console.log('import-preview', ip.status, JSON.stringify(ip.data).slice(0, 300));
const ic = await req('POST', '/project/import-confirm', { token, body: { rows: [{ name: 'a', customerCode: 'KH', dateOpen: '2026-08-27', category: '系统集成', stage: '初期沟通', source: '电话咨询', state: '跟踪', ownerId: 1 }] } });
console.log('import-confirm', ic.status, JSON.stringify(ic.data).slice(0, 300));

await req('DELETE', '/contract/' + cid, { token });
await req('DELETE', '/customer/' + cuid, { token });
