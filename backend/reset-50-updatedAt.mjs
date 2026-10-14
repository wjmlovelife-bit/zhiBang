import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'CrmCustomer' AND column_name LIKE '%pdat%'");
console.log('列名:', cols);

await p.$executeRawUnsafe(`UPDATE "CrmCustomer" SET "updatedAt" = '2026-08-31 06:14:14.333+00' WHERE id = 50`);
const c = await p.crmCustomer.findUnique({ where: { id: 50 } });
console.log('strategy:', c.strategy);
console.log('updatedAt:', c.updatedAt);
await p.$disconnect();
