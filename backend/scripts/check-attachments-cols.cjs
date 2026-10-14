const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'CrmOpportunity' AND column_name = 'attachments';");
  console.log('CrmOpportunity.attachments column exists:', cols.length > 0 ? 'YES' : 'NO');
  for (const t of ['CrmCustomer', 'BizInventory', 'BizPurchase', 'CrmWorkLog', 'CrmWeekSummary', 'CrmDailyReport']) {
    const r = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = '" + t + "' AND column_name = 'attachments';");
    console.log(t + '.attachments exists:', r.length > 0 ? 'YES' : 'NO');
  }
}
main().catch(e => console.error(e)).finally(() => p.$disconnect());
