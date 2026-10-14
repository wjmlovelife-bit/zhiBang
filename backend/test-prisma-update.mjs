// 测试 Prisma 5.x update 操作接收 id 字段的行为
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 先查询客户 674 实际字段
  try {
    const c = await prisma.crmCustomer.findUnique({ where: { id: 674 } });
    console.log('查询客户 674 成功');
    console.log('attachments 字段:', JSON.stringify(c?.attachments));

    // 测试 update 传 id 字段
    console.log('\n测试 1: update 时传 id 字段...');
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          id: 674,  // 重复 id
          name: c?.name || 'test',
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 updatedAt
    console.log('\n测试 2: update 时传 updatedAt 字段...');
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          name: c?.name || 'test',
          updatedAt: new Date(),
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 createdAt
    console.log('\n测试 3: update 时传 createdAt 字段...');
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          name: c?.name || 'test',
          createdAt: new Date(),
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 createdById, updatedById
    console.log('\n测试 4: update 时传 createdById, updatedById 字段...');
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          name: c?.name || 'test',
          createdById: 1,
          updatedById: 1,
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 inherits 数组
    console.log('\n测试 5: update 时传 inherits 数组（来自 detail 接口的关联数据）...');
    const d = await prisma.crmCustomer.findUnique({
      where: { id: 674 },
      include: { inherits: true },
    });
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          name: c?.name || 'test',
          inherits: d?.inherits || [],
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 follows 数组
    console.log('\n测试 6: update 时传 follows 数组...');
    const d2 = await prisma.crmCustomer.findUnique({
      where: { id: 674 },
      include: { follows: true },
    });
    try {
      const r = await prisma.crmCustomer.update({
        where: { id: 674 },
        data: {
          name: c?.name || 'test',
          follows: d2?.follows || [],
          attachments: c?.attachments || [],
        },
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

    // 测试 update 传 contacts 数组（带 id）
    console.log('\n测试 7: update 时传 contacts 数组（带 id）...');
    const d3 = await prisma.crmCustomer.findUnique({
      where: { id: 674 },
      include: { contacts: true },
    });
    try {
      const r = await prisma.$transaction(async (tx) => {
        await tx.crmContact.deleteMany({ where: { customerId: 674 } });
        return tx.crmCustomer.update({
          where: { id: 674 },
          data: {
            name: c?.name || 'test',
            contacts: { create: d3?.contacts || [] },  // contacts 数组带 id
            attachments: c?.attachments || [],
          },
        });
      });
      console.log('  OK, update 成功');
    } catch (e) {
      console.log('  ERR:', e.message?.slice(0, 200));
    }

  } catch (e) {
    console.log('主流程错误:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
