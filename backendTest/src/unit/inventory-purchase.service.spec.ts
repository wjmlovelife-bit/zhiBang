/**
 * InventoryService + PurchaseService 单元测试
 * 1. inventory list
 * 2. inventory create
 * 3. inventory export returns Buffer
 * 4. purchase list
 * 5. purchase create
 * 6. purchase export returns Buffer
 */
import { Test } from '@nestjs/testing';
import { InventoryService } from '@app/modules/inventory/inventory.service';
import { PurchaseService } from '@app/modules/purchase/purchase.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('InventoryService', () => {
  let service: InventoryService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [InventoryService, { provide: PrismaService, useValue: mock }],
    }).compile();
    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. list returns inventory items', async () => {
    setMock(mock, '$transaction', [5, [{ id: 1, productName: '产品A' }]]);
    const result: any = await service.list({});
    expect(result.total).toBe(5);
  });

  it('2. create writes inventory with required fields', async () => {
    setMock(mock, 'bizInventory.create', { id: 1 });
    await service.create({ productName: '产品A', productModel: 'M1', manufacturer: '厂A' }, { id: 1 });
    expect(mock.bizInventory.create).toHaveBeenCalled();
  });

  it('3. export returns array of inventory rows (admin sees all)', async () => {
    setMock(mock, 'bizInventory.findMany', [{ id: 1, productName: 'A' }]);
    const result: any = await service.export({ id: 1, isAdmin: true });
    // export 返回 findMany 数组，不是 Buffer
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it('3b. detail: non-biz-admin not owner → NotFoundException', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    await expect(service.detail(1, { id: 5, isAdmin: false, roleCodes: ['sales'] }))
      .rejects.toThrow();
  });

  it('3c. detail: biz-admin (purchase role) bypasses ownership', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    const r: any = await service.detail(1, { id: 5, isAdmin: false, roleCodes: ['purchase'] });
    expect(r.id).toBe(1);
  });

  it('3d. export: non-biz-admin (sales) still returns an array via data scope', async () => {
    setMock(mock, 'bizInventory.findMany', [{ id: 1, productName: 'A' }]);
    const result: any = await service.export({ id: 5, isAdmin: false, roleCodes: ['sales'] });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(mock.bizInventory.findMany).toHaveBeenCalled();
  });

  it('7. update: not found → NotFoundException', async () => {
    setMock(mock, 'bizInventory.findUnique', null);
    await expect(service.update(1, {}, { id: 5 })).rejects.toThrow('库存不存在');
  });

  it('8. update: non-biz-admin non-owner → NotFoundException(库存不存在)', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    await expect(
      service.update(1, { productName: 'X' }, { id: 5, isAdmin: false, roleCodes: ['sales'] }),
    ).rejects.toThrow('库存不存在');
    expect(mock.bizInventory.update).not.toHaveBeenCalled();
  });

  it('9. update: biz-admin updates with updatedById = user.id', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    setMock(mock, 'bizInventory.update', { id: 1 });
    await service.update(1, { productName: 'X' }, { id: 5, isAdmin: true });
    expect(mock.bizInventory.update).toHaveBeenCalled();
    expect(mock.bizInventory.update.mock.calls[0][0].data.updatedById).toBe(5);
    expect(mock.bizInventory.update.mock.calls[0][0].data.productName).toBe('X');
  });

  it('10. update: non-biz-admin owner updates own record', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 5, createdById: 99 });
    setMock(mock, 'bizInventory.update', { id: 1 });
    await service.update(1, { manufacturer: 'F' }, { id: 5, isAdmin: false, roleCodes: ['sales'] });
    expect(mock.bizInventory.update).toHaveBeenCalled();
    expect(mock.bizInventory.update.mock.calls[0][0].data.updatedById).toBe(5);
  });

  it('11. remove: non-biz-admin non-owner → NotFoundException', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    await expect(service.remove(1, { id: 5, isAdmin: false, roleCodes: ['sales'] }))
      .rejects.toThrow('库存不存在');
  });

  it('12. remove: biz-admin soft-deletes (isActive=false) with updatedById', async () => {
    setMock(mock, 'bizInventory.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    setMock(mock, 'bizInventory.update', { id: 1 });
    await service.remove(1, { id: 5, isAdmin: true });
    expect(mock.bizInventory.update).toHaveBeenCalled();
    const data = mock.bizInventory.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(false);
    expect(data.updatedById).toBe(5);
  });
});

describe('PurchaseService', () => {
  let service: PurchaseService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [PurchaseService, { provide: PrismaService, useValue: mock }],
    }).compile();
    service = module.get<PurchaseService>(PurchaseService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('4. list returns purchase items', async () => {
    setMock(mock, '$transaction', [3, [{ id: 1 }]]);
    const result: any = await service.list({});
    expect(result.total).toBe(3);
  });

  it('5. create writes purchase', async () => {
    setMock(mock, 'bizPurchase.create', { id: 1 });
    await service.create({ productName: 'P', productModel: 'M', manufacturer: 'F' }, { id: 1 });
    expect(mock.bizPurchase.create).toHaveBeenCalled();
  });

  it('6. export returns array of purchase rows', async () => {
    setMock(mock, 'bizPurchase.findMany', [{ id: 1, productName: 'P' }]);
    const result: any = await service.export({ id: 1, isAdmin: true });
    // 源 PurchaseService.export 返回 findMany 数组，不是 Buffer
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it('6b. export: non-biz-admin (sales) still returns an array via data scope', async () => {
    setMock(mock, 'bizPurchase.findMany', [{ id: 1, productName: 'P' }]);
    const result: any = await service.export({ id: 5, isAdmin: false, roleCodes: ['sales'] });
    expect(Array.isArray(result)).toBe(true);
    expect(mock.bizPurchase.findMany).toHaveBeenCalled();
  });

  it('7. update: not found → NotFoundException', async () => {
    setMock(mock, 'bizPurchase.findUnique', null);
    await expect(service.update(1, {}, { id: 5 })).rejects.toThrow('采购不存在');
  });

  it('8. update: non-biz-admin non-owner → NotFoundException(采购不存在)', async () => {
    setMock(mock, 'bizPurchase.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    await expect(
      service.update(1, { productName: 'X' }, { id: 5, isAdmin: false, roleCodes: ['sales'] }),
    ).rejects.toThrow('采购不存在');
    expect(mock.bizPurchase.update).not.toHaveBeenCalled();
  });

  it('9. update: biz-admin updates with updatedById = user.id', async () => {
    setMock(mock, 'bizPurchase.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    setMock(mock, 'bizPurchase.update', { id: 1 });
    await service.update(1, { productName: 'X' }, { id: 5, isAdmin: true });
    expect(mock.bizPurchase.update).toHaveBeenCalled();
    expect(mock.bizPurchase.update.mock.calls[0][0].data.updatedById).toBe(5);
  });

  it('10. update: non-biz-admin owner updates own record', async () => {
    setMock(mock, 'bizPurchase.findUnique', { id: 1, ownerId: 5, createdById: 99 });
    setMock(mock, 'bizPurchase.update', { id: 1 });
    await service.update(1, { manufacturer: 'F' }, { id: 5, isAdmin: false, roleCodes: ['sales'] });
    expect(mock.bizPurchase.update).toHaveBeenCalled();
    expect(mock.bizPurchase.update.mock.calls[0][0].data.updatedById).toBe(5);
  });

  it('11. remove: non-biz-admin non-owner → NotFoundException', async () => {
    setMock(mock, 'bizPurchase.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    await expect(service.remove(1, { id: 5, isAdmin: false, roleCodes: ['sales'] }))
      .rejects.toThrow('采购不存在');
  });

  it('12. remove: biz-admin soft-deletes (isActive=false) with updatedById', async () => {
    setMock(mock, 'bizPurchase.findUnique', { id: 1, ownerId: 99, createdById: 99 });
    setMock(mock, 'bizPurchase.update', { id: 1 });
    await service.remove(1, { id: 5, isAdmin: true });
    expect(mock.bizPurchase.update).toHaveBeenCalled();
    const data = mock.bizPurchase.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(false);
    expect(data.updatedById).toBe(5);
  });
});
