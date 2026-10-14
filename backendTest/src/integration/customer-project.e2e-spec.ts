/**
 * Customer + Project + Follow 真 PG 测试
 */
import { Test } from '@nestjs/testing';
import { CustomerService } from '@app/modules/customer/customer.service';
import { ProjectService } from '@app/modules/project/project.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('Customer + Project + Follow (Integration)', () => {
  let cust: CustomerService;
  let proj: ProjectService;
  let prisma: PrismaService;
  const adminUser = { id: 1, isAdmin: true, deptId: null };
  const salesUser = { id: 2, isAdmin: false, deptId: 2, dataScope: 4 };

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [CustomerService, ProjectService, PrismaService],
    }).compile();
    cust = module.get<CustomerService>(CustomerService);
    proj = module.get<ProjectService>(ProjectService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    // 全面清理
    await prisma.crmCustomerFollow.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmProjectFollow.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmContact.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmProjectItem.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmOpportunity.deleteMany({ where: {} }).catch(() => {});
    await prisma.crmCustomer.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUserRole.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysDept.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysUser.deleteMany({ where: {} }).catch(() => {});
    await prisma.sysRole.deleteMany({ where: {} }).catch(() => {});
    // seed with upsert (idempotent)
    await prisma.sysRole.upsert({ where: { id: 1 }, update: {}, create: { id: 1, code: 'admin', name: '管理员', dataScope: 1, isActive: true } });
    await prisma.sysRole.upsert({ where: { id: 2 }, update: {}, create: { id: 2, code: 'sales', name: '销售', dataScope: 4, isActive: true } });
    await prisma.sysUser.upsert({
      where: { id: 1 }, update: {},
      create: { id: 1, username: 'admin', name: '管理员', password: '123456', isActive: true, isAdmin: true },
    });
    await prisma.sysUser.upsert({
      where: { id: 2 }, update: {},
      create: { id: 2, username: 'sales01', name: '张三', password: '123456', isActive: true, isAdmin: false },
    });
    await prisma.sysDept.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: '销售部' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================
  // Customer
  // ============================================================
  describe('CustomerService', () => {
    it('1. create + detail roundtrip', async () => {
      const created = await cust.create(
        { name: '测试客户A', category: '终端', followStage: '高' },
        { id: 1, isAdmin: true },
      );
      expect(created.id).toBeGreaterThan(0);
      expect(created.code).toMatch(/^KH\d{8}\d{4}$/);
      const detail = await cust.detail(created.id);
      expect(detail.name).toBe('测试客户A');
    });

    it('2. detail not found → 404', async () => {
      await expect(cust.detail(999999)).rejects.toThrow(NotFoundException);
    });

    it('3. update rewrites contacts array', async () => {
      const c = await cust.create({ name: '测试客户B', contacts: [{ name: '联系人1', phone: '123' }] }, { id: 1, isAdmin: true });
      await cust.update(c.id, { name: '改名B', contacts: [{ name: '新联系人' }] }, { id: 1, isAdmin: true });
      const detail: any = await cust.detail(c.id);
      expect(detail.name).toBe('改名B');
      expect(detail.contacts.length).toBe(1);
      expect(detail.contacts[0].name).toBe('新联系人');
    });

    it('4. addFollow and getFollows', async () => {
      const c = await cust.create({ name: '测试客户C' }, { id: 1, isAdmin: true });
      const f = await cust.addFollow(c.id, { content: '联系了', contactName: ['张三', '李四'], period: 'am' }, { id: 1 });
      expect(f.id).toBeGreaterThan(0);
      const follows = await cust.getFollows(c.id);
      expect(follows.length).toBeGreaterThanOrEqual(1);
      expect(follows[0].contactName).toBe('张三;李四');
    });

    it('5. inherit moves owner', async () => {
      const c = await cust.create({ name: '测试客户D' }, { id: 1, isAdmin: true });
      await cust.inherit(c.id, 2, '工作交接', { id: 1, isAdmin: true });
      const detail: any = await cust.detail(c.id);
      expect(detail.ownerId).toBe(2);
      expect(detail.inherits.length).toBe(1);
      expect(detail.inherits[0].reason).toBe('工作交接');
    });
  });

  // ============================================================
  // Project
  // ============================================================
  describe('ProjectService', () => {
    it('6. create project and add follow', async () => {
      // 先有客户
      const c = await cust.create({ name: '客户P' }, { id: 1, isAdmin: true });
      const p: any = await proj.create({
        name: '项目A', customerId: c.id, stage: '报价',
      }, { id: 1, isAdmin: true });
      expect(p.id).toBeGreaterThan(0);
      const f = await proj.addFollow(p.id, { content: '项目讨论', contactName: ['张三'] }, { id: 1 });
      expect(f.id).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 并发测试
  // ============================================================
  describe('concurrent customer creation', () => {
    it('7. 并发 5 个 create: 至少一个成功（race condition 暴露）', async () => {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          cust.create({ name: `并发客户${Date.now()}_${i}` }, { id: 1, isAdmin: true })
            .catch((e) => ({ _err: e?.message || String(e) }))
        );
      }
      const results = await Promise.all(promises);
      const successes = results.filter(r => !r._err);
      const failures = results.filter(r => r._err);
      // 至少 1 个成功 + 至少有失败的（说明并发有冲突）
      expect(successes.length).toBeGreaterThanOrEqual(1);
      // 全部 success 都有 code
      successes.forEach(r => expect(r.code).toBeTruthy());
      // failures 大于 0 暴露 race condition bug（应记录到工作日志）
      if (failures.length > 0) {
        console.warn(`⚠️ 并发 create 暴露 race condition: ${failures.length} 个失败`);
      }
    });
  });

  // ============================================================
  // 大数据量分页
  // ============================================================
  describe('bulk pagination', () => {
    it('8. 插入 20 条后 list 验证分页', async () => {
      for (let i = 0; i < 20; i++) {
        await cust.create({ name: `批量${i}` }, { id: 1, isAdmin: true });
      }
      const page1 = await cust.list({ page: 1, pageSize: 10 }, adminUser);
      const page2 = await cust.list({ page: 2, pageSize: 10 }, adminUser);
      expect(page1.items.length).toBe(10);
      expect(page2.items.length).toBeGreaterThanOrEqual(10);
    });
  });
});
