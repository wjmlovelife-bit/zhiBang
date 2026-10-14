/**
 * InventoryService + PurchaseService 集成测试（真 PG）
 *
 * 覆盖：
 *  - inventory create + list + 软删 + export
 *  - purchase create + list + 软删
 *  - biz-admin (purchase 角色) 看全部 vs sales 仅自己
 */
import { Test } from '@nestjs/testing';
import { InventoryService } from '@app/modules/inventory/inventory.service';
import { PurchaseService } from '@app/modules/purchase/purchase.service';
import { PrismaService } from '@app/prisma/prisma.service';

describe('Inventory + Purchase (Integration)', () => {
  let inventory: InventoryService;
  let purchase: PurchaseService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
    const module = await Test.createTestingModule({
      providers: [InventoryService, PurchaseService, PrismaService],
    }).compile();
    inventory = module.get<InventoryService>(InventoryService);
    purchase = module.get<PurchaseService>(PurchaseService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
    await prisma.bizInventory.deleteMany({ where: { productName: { startsWith: 'E2E-INV-' } } }).catch(() => {});
    await prisma.bizPurchase.deleteMany({ where: { productName: { startsWith: 'E2E-PUR-' } } }).catch(() => {});
    await prisma.sysUser.upsert({
      where: { id: 2 }, update: {},
      create: { id: 2, username: 'sales01_inv', name: '张三', password: '123456', isActive: true },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  describe('InventoryService', () => {
    it('1. create 必填校验：缺 productName → NotFound', async () => {
      await expect(inventory.create(
        { productModel: 'M', manufacturer: 'F' },
        { id: 2 },
      )).rejects.toThrow();
    });

    it('2. create + list + export（含 isActive=true 过滤）', async () => {
      const r: any = await inventory.create(
        { productName: 'E2E-INV-001', productModel: 'M1', manufacturer: 'F1' },
        { id: 2, deptId: 1 },
      );
      expect(r.id).toBeGreaterThan(0);

      const listR: any = await inventory.list({ pageSize: 100 }, { id: 2, isAdmin: false, dataScope: 4 });
      expect(listR.items.length).toBeGreaterThan(0);
      // ownerId 应等于 2
      for (const item of listR.items) {
        expect(item.ownerId).toBe(2);
      }

      const exportR: any = await inventory.export({ id: 2, isAdmin: false, dataScope: 4 });
      expect(Array.isArray(exportR)).toBe(true);
    });

    it('3. 软删（remove → isActive=false）', async () => {
      const r: any = await inventory.create(
        { productName: 'E2E-INV-DEL', productModel: 'M2', manufacturer: 'F2' },
        { id: 2, deptId: 1 },
      );
      await inventory.remove(r.id, { id: 2, isAdmin: false, roleCodes: ['sales'] });
      const after: any = await prisma.bizInventory.findUnique({ where: { id: r.id } });
      expect(after.isActive).toBe(false);
    });

    it('4. biz-admin (purchase 角色) 看全部', async () => {
      // ownerId=2（已存在的 sales 用户）以避免 FK 失败（id=99 sysUser 不存在）
      const r: any = await inventory.create(
        { productName: 'E2E-INV-OTHER', productModel: 'M3', manufacturer: 'F3' },
        { id: 2, deptId: 1 },
      );
      // purchase 角色能看到（不靠 dataScope，全模块白名单）
      const listR: any = await inventory.list(
        { pageSize: 100 },
        { id: 1, isAdmin: false, roleCodes: ['purchase'] },
      );
      const found = listR.items.find((i: any) => i.id === r.id);
      expect(found).toBeDefined();
    });
  });

  describe('PurchaseService', () => {
    it('5. create + list + 软删', async () => {
      const r: any = await purchase.create(
        { productName: 'E2E-PUR-001', productModel: 'M', manufacturer: 'F' },
        { id: 2, deptId: 1 },
      );
      expect(r.id).toBeGreaterThan(0);

      const listR: any = await purchase.list({ pageSize: 100 }, { id: 2, isAdmin: false, dataScope: 4 });
      expect(listR.items.length).toBeGreaterThan(0);

      await purchase.remove(r.id, { id: 2, isAdmin: false, roleCodes: ['sales'] });
      const after: any = await prisma.bizPurchase.findUnique({ where: { id: r.id } });
      expect(after.isActive).toBe(false);
    });
  });
});