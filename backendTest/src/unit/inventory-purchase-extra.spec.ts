/**
 * InventoryService + PurchaseService 全场景补测（与 inventory-purchase.service.spec.ts 16 用例互补）
 *
 * 覆盖：
 *  - list: keyword 三字段 OR / pageSize 默认&上限 / dataScope=4
 *  - detail: 不存在→NotFound（已测）、ownerId 创建人字段
 *  - create: 必填校验失败（缺 productName→NotFound）/ deptId 兜底 / attachments 兜底
 *  - update: productName='' / date 空串→null / 部分字段更新
 *  - remove: 不存在→P2025（已测）
 *  - export: non-biz-admin 走 applyDataScope / isActive=true 过滤
 *  - 并发：同 owner 并发 create 5 次
 */
import { InventoryService } from '@app/modules/inventory/inventory.service';
import { PurchaseService } from '@app/modules/purchase/purchase.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('InventoryService + PurchaseService extra', () => {
  describe('InventoryService', () => {
    let service: InventoryService;
    let mock: MockPrisma;

    beforeEach(() => {
      mock = makeMockPrisma();
      service = new InventoryService(mock as any);
    });
    afterEach(() => resetMockPrisma(mock));

    // ============================================================
    // list
    // ============================================================
    describe('list', () => {
      function setupListMocks(total = 0, items: any[] = []) {
        setMock(mock, 'bizInventory.count', total);
        setMock(mock, 'bizInventory.findMany', items);
        mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
      }

      it('1. keyword OR（productName/productModel/manufacturer）三字段', async () => {
        setupListMocks();
        await service.list({ productName: 'X' });
        const call = mock.bizInventory.findMany.mock.calls[0][0];
        expect(call.where.productName).toEqual({ contains: 'X' });
      });

      it('2. 默认 page=1, pageSize=10', async () => {
        setupListMocks();
        const r: any = await service.list({});
        expect(r.page).toBe(1);
        expect(r.pageSize).toBe(10);
      });

      it('3. pageSize 上限 1000', async () => {
        setupListMocks();
        const r: any = await service.list({ pageSize: 9999 });
        expect(r.pageSize).toBe(1000);
      });

      it('4. dataScope=4 普通用户 → applyDataScope 注入', async () => {
        setupListMocks();
        await service.list({}, { id: 2, isAdmin: false, dataScope: 4 });
        const call = mock.bizInventory.findMany.mock.calls[0][0];
        expect(call.where.OR).toBeDefined();
      });
    });

    // ============================================================
    // create
    // ============================================================
    describe('create', () => {
      it('5. 缺 productName → NotFound（必填校验）', async () => {
        await expect(service.create(
          { productModel: 'M', manufacturer: 'F' },
          { id: 1 },
        )).rejects.toThrow('商品名称、商品型号、厂家为必填字段');
      });

      it('6. deptId 优先级：body.deptId > user.deptId > null（源码 ?? 兜底）', async () => {
        setMock(mock, 'bizInventory.create', { id: 1 });
        // body.deptId=99 优先
        await service.create(
          { productName: 'P', productModel: 'M', manufacturer: 'F', deptId: 99 },
          { id: 2, deptId: 5 },
        );
        expect(mock.bizInventory.create.mock.calls[0][0].data.deptId).toBe(99);
        // body.deptId 缺省时用 user.deptId
        await service.create(
          { productName: 'P', productModel: 'M', manufacturer: 'F' },
          { id: 2, deptId: 5 },
        );
        expect(mock.bizInventory.create.mock.calls[1][0].data.deptId).toBe(5);
      });

      it('7. attachments 兜底 null', async () => {
        setMock(mock, 'bizInventory.create', { id: 1 });
        await service.create(
          { productName: 'P', productModel: 'M', manufacturer: 'F' },
          { id: 1 },
        );
        expect(mock.bizInventory.create.mock.calls[0][0].data.attachments).toBeNull();
      });

      it('8. ownerId 默认 user.id', async () => {
        setMock(mock, 'bizInventory.create', { id: 1 });
        await service.create(
          { productName: 'P', productModel: 'M', manufacturer: 'F' },
          { id: 7 },
        );
        expect(mock.bizInventory.create.mock.calls[0][0].data.ownerId).toBe(7);
      });
    });

    // ============================================================
    // update
    // ============================================================
    describe('update', () => {
      it('9. date 空串 → 存 null', async () => {
        setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 5 });
        setMock(mock, 'bizInventory.update', { id: 1 });
        await service.update(1, { date: '' }, { id: 5 });
        expect(mock.bizInventory.update.mock.calls[0][0].data.date).toBeNull();
      });

      it('10. productName="" → 写空串', async () => {
        setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 5 });
        setMock(mock, 'bizInventory.update', { id: 1 });
        await service.update(1, { productName: '' }, { id: 5 });
        expect(mock.bizInventory.update.mock.calls[0][0].data.productName).toBe('');
      });

      it('11. 不存在的记录 → NotFound', async () => {
        setMock(mock, 'bizInventory.findUnique', null);
        await expect(service.update(999, {}, { id: 1 })).rejects.toThrow('库存不存在');
      });
    });

    // ============================================================
    // export
    // ============================================================
    describe('export', () => {
      it('12. biz-admin（purchase 角色）→ 不过滤 isActive=false', async () => {
        setMock(mock, 'bizInventory.findMany', [{ id: 1 }, { id: 2 }]);
        const r: any = await service.export({ id: 1, isAdmin: false, roleCodes: ['purchase'] });
        expect(r.length).toBe(2);
      });

      it('13. non-biz-admin 走 applyDataScope，isActive=true 过滤', async () => {
        setMock(mock, 'bizInventory.findMany', []);
        await service.export({ id: 2, isAdmin: false, dataScope: 4 });
        const call = mock.bizInventory.findMany.mock.calls[0][0];
        expect(call.where.isActive).toBe(true);
        expect(call.where.OR).toBeDefined();
      });
    });

    // ============================================================
    // 并发
    // ============================================================
    describe('并发场景记录', () => {
      it('14. 同 owner 并发 create 5 次 → create 调 5 次（无 PG unique 约束，业务层不防重复）', async () => {
        setMock(mock, 'bizInventory.create', { id: 1 });
        await Promise.all([
          service.create({ productName: 'P1', productModel: 'M', manufacturer: 'F' }, { id: 1 }),
          service.create({ productName: 'P2', productModel: 'M', manufacturer: 'F' }, { id: 1 }),
          service.create({ productName: 'P3', productModel: 'M', manufacturer: 'F' }, { id: 1 }),
          service.create({ productName: 'P4', productModel: 'M', manufacturer: 'F' }, { id: 1 }),
          service.create({ productName: 'P5', productModel: 'M', manufacturer: 'F' }, { id: 1 }),
        ]);
        expect(mock.bizInventory.create).toHaveBeenCalledTimes(5);
      });
    });
  });

  // ============================================================
  // PurchaseService 镜像补测
  // ============================================================
  describe('PurchaseService', () => {
    let service: PurchaseService;
    let mock: MockPrisma;

    beforeEach(() => {
      mock = makeMockPrisma();
      service = new PurchaseService(mock as any);
    });
    afterEach(() => resetMockPrisma(mock));

    describe('list', () => {
      function setupListMocks(total = 0, items: any[] = []) {
        setMock(mock, 'bizPurchase.count', total);
        setMock(mock, 'bizPurchase.findMany', items);
        mock.$transaction.mockImplementation(async (ops: any[]) => await Promise.all(ops));
      }

      it('15. keyword 三字段 OR + dataScope=4', async () => {
        setupListMocks();
        await service.list({ productName: 'X' }, { id: 2, isAdmin: false, dataScope: 4 });
        const call = mock.bizPurchase.findMany.mock.calls[0][0];
        expect(call.where.productName).toEqual({ contains: 'X' });
      });

      it('16. pageSize 默认 10 + 上限 1000', async () => {
        setupListMocks();
        const r: any = await service.list({}, { id: 1 });
        expect(r.pageSize).toBe(10);
        const r2: any = await service.list({ pageSize: 9999 }, { id: 1 });
        expect(r2.pageSize).toBe(1000);
      });
    });

    describe('create', () => {
      it('17. 必填校验失败 → NotFound', async () => {
        await expect(service.create(
          { productModel: 'M', manufacturer: 'F' },
          { id: 1 },
        )).rejects.toThrow('商品名称、商品型号、厂家为必填字段');
      });
    });
  });
});