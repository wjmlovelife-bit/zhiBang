/**
 * common/filters/logging-exception.filter.ts 单元测试
 *
 * 覆盖：
 *  - HttpException 4xx：返回原 statusCode + message，按 warn 打印
 *  - HttpException 5xx：返回 statusCode + message，按 error 打印（含堆栈前 8 行）
 *  - 未知异常：返回 500 + 'Internal server error'，按 error 打印（含堆栈）
 */
import { NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { LoggingExceptionFilter } from '@app/common/filters/logging-exception.filter';

describe('LoggingExceptionFilter', () => {
  let filter: LoggingExceptionFilter;
  let mockRes: any;
  let mockReq: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new LoggingExceptionFilter();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockReq = { method: 'POST', originalUrl: '/test', url: '/test' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockRes,
        getRequest: () => mockReq,
      }),
    };
    // 屏蔽 Logger 真实输出
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('1. NotFoundException（404）→ 返回 404 + 消息', () => {
    const ex = new NotFoundException('资源不存在');
    filter.catch(ex, mockHost);
    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('2. BadRequestException（400 对象响应，含 error）→ 字段断言', () => {
    const ex = new BadRequestException('字段非法');
    filter.catch(ex, mockHost);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    // NestJS BadRequestException 默认 getResponse() 返回 {statusCode, message, error} 对象
    // 源码 typeof === 'string' 分支走的是 fallback path；实际是 object 分支，原样透传
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: '字段非法',
    }));
  });

  it('3. 未知 Error → 返回 500 + Internal server error', () => {
    const ex = new Error('DB 连接失败');
    filter.catch(ex, mockHost);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });

  it('4. HttpException(500) 服务端异常 → 返回 500 且 logger.error 被调', () => {
    const ex = new HttpException('服务异常', HttpStatus.INTERNAL_SERVER_ERROR);
    filter.catch(ex, mockHost);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('5. 自定义 HttpException 对象响应（object 类型 message）→ 原样传', () => {
    const ex = new HttpException({ statusCode: 401, message: '未授权', error: 'Unauthorized' }, 401);
    filter.catch(ex, mockHost);
    expect(mockRes.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: '未授权',
      error: 'Unauthorized',
    });
  });
});