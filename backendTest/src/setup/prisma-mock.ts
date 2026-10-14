/**
 * Prisma 客户端 mock helper
 * - 通过 jest.mock 替换 @prisma/client 的 PrismaClient
 * - 提供 mockPrisma 实例：可设置返回值 / 校验调用
 *
 * 用法：
 *   import { makeMockPrisma, resetMockPrisma } from '../setup/prisma-mock';
 *   const mock = makeMockPrisma();
 *   jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mock) }));
 */
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrisma = DeepMockProxy<any>;

export function makeMockPrisma(): MockPrisma {
  return mockDeep<any>({
    // 简化深度（避免过度递归）
    depth: 2,
  });
}

export function resetMockPrisma(mock: MockPrisma) {
  mockReset(mock);
}

/**
 * 给 Prisma 模型方法设置返回值
 *   setMock(mock, 'crmCustomer.findUnique', { id: 1, name: 'test' });
 *   setMock(mock, 'crmCustomer.findMany', [{ id: 1 }, { id: 2 }]);
 *   setMock(mock, 'crmCustomer.create', { id: 999 });
 *   setMock(mock, 'crmCustomer.update', { id: 1, name: 'updated' });
 *   setMock(mock, 'crmCustomer.delete', { id: 1 });
 */
export function setMock(mock: MockPrisma, path: string, value: any) {
  const parts = path.split('.');
  let obj: any = mock;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]].mockResolvedValue(value);
}

/**
 * 设置 mock 抛出错误
 */
export function setMockError(mock: MockPrisma, path: string, error: any) {
  const parts = path.split('.');
  let obj: any = mock;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]].mockRejectedValue(error);
}
