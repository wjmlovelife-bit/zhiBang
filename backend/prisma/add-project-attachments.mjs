// 给 CrmOpportunity 加 attachments 字段（JSONB，可空）
// 幂等：使用 IF NOT EXISTS 兼容 PG 9.6+
// 运行：node backend/prisma/add-project-attachments.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // 1) 加列（如果不存在）
  await p.$executeRawUnsafe(
    `ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "attachments" JSONB;`,
  );
  console.log('已确保 CrmOpportunity.attachments 存在');

  // 2) 校验
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'CrmOpportunity' AND column_name = 'attachments';`,
  );
  console.log('当前 CrmOpportunity.attachments 列信息：', cols);

  // 3) 提示：还需要重新生成 Prisma client 才能在 service 里用
  //    运行：npx prisma generate
  console.log('\n下一步：运行 `npx prisma generate` 重新生成 Prisma client，然后重启后端');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
