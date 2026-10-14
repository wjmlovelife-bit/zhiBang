/**
 * ProjectService 单元测试（核心）
 * 1. list: 查询 + 分页
 * 2. detail
 * 3. addFollow
 * 4. updateFollow
 * 5. searchCustomer
 */
import { Test } from '@nestjs/testing';
import { ProjectService } from '@app/modules/project/project.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('ProjectService', () => {
  let service: ProjectService;
  let mock: MockPrisma;
  const user = { id: 1, isAdmin: true, deptId: 1 };

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<ProjectService>(ProjectService);
    setMock(mock, 'sysUser.findMany', []);
    setMock(mock, 'sysDept.findMany', []);
    setMock(mock, 'crmProjectInherit.findMany', []);
    setMock(mock, 'sysRole.findMany', []);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. list paginates and applies dataScope', async () => {
    setMock(mock, '$transaction', [5, [{ id: 1, name: '项目A' }]]);
    const result: any = await service.list({ page: 1, pageSize: 10 }, user);
    expect(result.total).toBe(5);
    expect(result.items.length).toBe(1);
  });

  it('2. detail returns project with relations', async () => {
    setMock(mock, 'crmOpportunity.findUnique', { id: 1, name: '项目A', follows: [], items: [] });
    const result: any = await service.detail(1);
    expect(result.id).toBe(1);
  });

  it('3. addFollow creates follow with projectId', async () => {
    setMock(mock, 'crmProjectFollow.create', { id: 99 });
    await service.addFollow(1, { content: '测试', contactName: ['张三'] }, user);
    const call = mock.crmProjectFollow.create.mock.calls[0][0];
    expect(call.data.projectId).toBe(1);
    expect(call.data.contactName).toBe('张三');
  });

  it('4. updateFollow throws when not found', async () => {
    setMock(mock, 'crmProjectFollow.findFirst', null);
    await expect(service.updateFollow(1, 99, { content: 'x' }, user)).rejects.toThrow();
  });

  it('5. searchCustomer returns matching customers', async () => {
    setMock(mock, 'crmCustomer.findMany', [{ id: 1, name: '客户A', code: 'KH001' }]);
    const result: any = await service.searchCustomer('客户');
    expect(result.length).toBe(1);
    expect(result[0].code).toBe('KH001');
  });
});
