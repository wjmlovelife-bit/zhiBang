import { PrismaClient } from '@prisma/client';
import { scrub, normalizeDates } from './src/common/utils/payload';
const prisma = new PrismaClient();

async function main() {
  const d: any = await prisma.crmCustomer.findUnique({ where: { id: 767 } });
  console.log('d.paymentLimitPct:', d.paymentLimitPct);
  console.log('  type:', typeof d.paymentLimitPct);
  console.log('  constructor:', d.paymentLimitPct?.constructor?.name);
  console.log('  toString:', String(d.paymentLimitPct));

  console.log('\nd.registeredCapital:', d.registeredCapital);
  console.log('  type:', typeof d.registeredCapital);
  console.log('  constructor:', d.registeredCapital?.constructor?.name);

  // scrub 后
  const scrubbed = scrub('CrmCustomer', d);
  console.log('\nscrubbed.paymentLimitPct:', scrubbed.paymentLimitPct);
  console.log('  type:', typeof scrubbed.paymentLimitPct);
  console.log('  constructor:', scrubbed.paymentLimitPct?.constructor?.name);

  // normalize 后
  const norm = normalizeDates(scrubbed);
  console.log('\nnorm.paymentLimitPct:', norm.paymentLimitPct);
  console.log('  type:', typeof norm.paymentLimitPct);
  console.log('  constructor:', norm.paymentLimitPct?.constructor?.name);
}
main().finally(() => prisma.$disconnect());
