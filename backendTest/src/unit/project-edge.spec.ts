/**
 * ProjectService 边界用例（覆盖 modules/project/project.service.ts: remove 权限闸门）
 *
 * 直接实例化（仅依赖 PrismaService）。验证：
 * - admin（dataScope=1）调用 remove → 调用 crmOpportunity.delete
 * - 销售等角色（dataScope≠1）调用 remove → 抛 ForbiddenException，且不触发 delete
 * - user 为 null/undefined → 抛 ForbiddenException（防御性）
 *
 * 与 customer-edge.spec.ts 保持同一范式（2026-09-22 同源权限需求）。
 */
import { ProjectService } from '@app/modules/project/project.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('ProjectService edge (remove 权限闸门)', () => {
  let service: ProjectService;
  let mock: MockPrisma;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new ProjectService(mock as any);
  });
  afterEach(() => resetMockPrisma(mock));

  it('1. admin（dataScope=1）remove → 调用 crmOpportunity.delete', async () => {
    setMock(mock, 'crmOpportunity.delete', { id: 1 });
    const admin = { id: 1, isAdmin: true, dataScope: 1 } as any;
    await service.remove(1, admin);
    expect(mock.crmOpportunity.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('2. ⚠ 行为记录：销售角色（dataScope=4）remove → ForbiddenException，不删库', async () => {
    const sales = { id: 2, isAdmin: false, dataScope: 4 } as any;
    setMock(mock, 'crmOpportunity.delete', { id: 1 });
    await expect(service.remove(1, sales)).rejects.toThrow('仅管理员可删除项目');
    expect(mock.crmOpportunity.delete).not.toHaveBeenCalled();
  });

  it('3. ⚠ 行为记录：leader（dataScope=2）remove → ForbiddenException', async () => {
    const leader = { id: 24, isAdmin: true, dataScope: 2 } as any;
    setMock(mock, 'crmOpportunity.delete', { id: 1 });
    await expect(service.remove(1, leader)).rejects.toThrow('仅管理员可删除项目');
    expect(mock.crmOpportunity.delete).not.toHaveBeenCalled();
  });

  it('4. ⚠ 防御：user 为 null → ForbiddenException', async () => {
    setMock(mock, 'crmOpportunity.delete', { id: 1 });
    await expect(service.remove(1, null as any)).rejects.toThrow('仅管理员可删除项目');
    expect(mock.crmOpportunity.delete).not.toHaveBeenCalled();
  });
});
