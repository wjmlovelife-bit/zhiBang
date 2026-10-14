// 写入第一条公司信息（幂等：仅在表为空时创建，避免覆盖用户后续修改）
// 运行：node backend/prisma/add-company-info.mjs
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const exists = await p.sysCompany.findFirst({ orderBy: { id: 'asc' } });
  if (exists) {
    console.log('公司信息已存在，跳过写入（id=%d, name=%s）', exists.id, exists.name);
    return;
  }
  const c = await p.sysCompany.create({
    data: {
      name: '陕西飞创腾达电子科技有限公司',
      shortName: null,
      bankName: '西安银行电子五路支行',
      account: '915011580000069268',
      phone: '029-89280290',
      address: '陕西省西安市高新区丈八街办西万路口高山流水和城4幢2门901室',
      taxNo: null,
      email: null,
      website: null,
      logoUrl: null,
      remark: null,
    },
  });
  console.log('已写入公司信息：', c.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
