/**
 * FollowService 单元测试（核心）
 * 1. contacts: returns contacts by followerId
 */
import { Test } from '@nestjs/testing';
import { FollowService } from '@app/modules/follow/follow.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { makeMockPrisma, MockPrisma, setMock, resetMockPrisma } from '../setup/prisma-mock';

describe('FollowService', () => {
  let service: FollowService;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        FollowService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get<FollowService>(FollowService);
  });

  afterEach(() => resetMockPrisma(mock));

  it('1. getContactsByFollower returns customer contacts assigned to follower', async () => {
    // 源 FollowService.getContactsByFollower：普通用户按 ownerId=自己 查客户，再展开其 contacts
    setMock(mock, 'crmCustomer.findMany', [
      {
        id: 100, name: '客户A',
        contacts: [{ id: 1, name: '李四', mobile: '138', department: '采购', position: '经理' }],
      },
      {
        id: 101, name: '客户B',
        contacts: [{ id: 2, name: '王五', mobile: '139', department: '技术', position: '工程师' }],
      },
    ]);
    const result: any = await service.getContactsByFollower(2, { id: 2, isAdmin: false });
    expect(result.length).toBe(2);
    // 映射后字段：contactName / customerId / customerName
    expect(result[0].contactName).toBe('李四');
    expect(result[0].customerName).toBe('客户A');
    expect(result[0].customerId).toBe(100);
    // 验证查询条件：普通用户按 ownerId = followerId 过滤
    const call = mock.crmCustomer.findMany.mock.calls[0][0];
    expect(call.where.ownerId).toBe(2);
  });
});
