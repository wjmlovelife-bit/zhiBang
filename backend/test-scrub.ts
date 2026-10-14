import { PrismaClient } from '@prisma/client';
import { scrub, normalizeDates } from './src/common/utils/payload';
const prisma = new PrismaClient();

async function main() {
  const d: any = await prisma.crmCustomer.findUnique({ where: { id: 767 } });
  console.log('d keys:', Object.keys(d).length);

  const scrubbed = scrub('CrmCustomer', d);
  console.log('scrubbed keys:', Object.keys(scrubbed).length);
  console.log('scrubbed 字段:', Object.keys(scrubbed).sort().join(', '));
  console.log();

  // 打印 scrubbed 字段值的类型
  for (const k of Object.keys(scrubbed).sort()) {
    const v = scrubbed[k];
    const type = Array.isArray(v) ? `array[${v.length}]` : v === null ? 'null' : typeof v;
    console.log(`  ${k}: ${type}`);
  }
  console.log();

  const normalized = normalizeDates(scrubbed);
  console.log('normalized.attachments[0]:', JSON.stringify(normalized.attachments?.[0]));

  // 看 attachments 里的对象
  if (Array.isArray(normalized.attachments)) {
    for (const a of normalized.attachments) {
      console.log('  attachment:', JSON.stringify(a));
    }
  }
}
main().finally(() => prisma.$disconnect());
