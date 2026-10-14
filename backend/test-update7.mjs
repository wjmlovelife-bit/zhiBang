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
  const d = await prisma.crmCustomer.findUnique({ where: { id: 674 }, include: { contacts: true, follows: true, inherits: true } });
  const form = { name: d.name, code: d.code, id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, ownerId: d.ownerId, deptId: d.deptId, contacts: d.contacts, follows: d.follows, inherits: d.inherits };
  const payload = { ...form };
  let body = normalizeDates(payload);
  const { contacts, ...rest } = body;
  const data = { ...rest, updatedById: 1 };
  for (const k of ['owner', 'dept', 'createdBy', 'updatedBy', 'inherits', 'follows', 'opportunities']) delete data[k];
  data.contacts = { create: [] };

  console.log('data.id:', data.id, 'typeof:', typeof data.id);
  console.log('data.createdAt:', data.createdAt, 'constructor:', data.createdAt?.constructor?.name, 'isDate:', data.createdAt instanceof Date);
  console.log('data.updatedAt:', data.updatedAt, 'constructor:', data.updatedAt?.constructor?.name, 'isDate:', data.updatedAt instanceof Date);
  console.log('data.ownerId:', data.ownerId);
  console.log('data.deptId:', data.deptId);
  console.log('data.contacts:', data.contacts);
  console.log('data.follows (should be undefined):', data.follows);
  console.log('data.inherits (should be undefined):', data.inherits);
  console.log('---');
  console.log('all data keys:', Object.keys(data).join(', '));

  // 跑 prisma update
  try {
    const r = await prisma.crmCustomer.update({ where: { id: 674 }, data });
    console.log('OK');
  } catch (e) {
    const lines = e.message.split('\n');
    const reason = lines.find((l) => l.includes('Unknown') || l.includes('Argument') || l.includes('prisma') || l.includes('Cannot')) || lines[0];
    console.log('ERR:', reason?.slice(0, 300));
  }
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
