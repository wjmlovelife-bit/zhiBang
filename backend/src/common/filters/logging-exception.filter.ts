import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { requestContext } from '../request-context';

/**
 * 诊断用全局异常过滤器
 * - 保留 NestJS 默认的 HttpException 响应结构（statusCode/message 等）不变
 * - 额外把所有异常的 name/message/stack 用 pinoLogger 醒目的打印到 logs/zhibang-*.log
 * - 让 500 错误的真实原因能够在后端日志一目了然
 *
 * 13. RequestId 落地（2026-09-23 加）：
 * - 所有日志前缀带 `[req=<requestId>]`，便于一次请求的全链路 grep 关联
 * - 响应 JSON 额外返回 `requestId` 字段，前端可在网络面板/Toast 里直接复制给运维
 *
 * 14. 切到 pinoLogger（2026-09-28 加）：
 * - 替换 NestJS 内置 Logger → pinoLogger，自动写入 backend/logs/zhibang-yyyy-MM-dd.log
 * - 4xx 也按 warn 级别落盘（之前只 warn 不写文件，现在能 grep）
 * - 5xx 按 error 级别落盘 + 完整 stack
 */
@Catch()
export class LoggingExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger('ExceptionsHandler') private readonly logger: PinoLogger) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // 1) 计算 status/响应体（与 NestJS 默认保持一致，避免破坏前端行为）
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any;
    if (isHttp) {
      const r = exception.getResponse();
      body = typeof r === 'string' ? { statusCode: status, message: r } : r;
    } else {
      body = { statusCode: status, message: 'Internal server error' };
    }

    // 2) 详细异常日志（按级别分类）
    const where = `${req?.method} ${req?.originalUrl || req?.url}`;
    // 优先从 req.requestId 取（main.ts 中间件写入）；取不到再退到 AsyncLocalStorage；最后退到 '-'
    const reqId =
      (req as any)?.requestId || requestContext.getRequestId();

    // 上下文字段：reqId + where，方便 grep
    const logCtx = { reqId, where, status, name: exception?.name, message: exception?.message };

    if (isHttp && status < 500) {
      // 4xx 按 warn 级别落盘
      this.logger.warn({ ...logCtx }, `4xx: ${exception.name}: ${exception.message}`);
    } else {
      // 5xx 或非 HttpException：完整堆栈，方便定位
      const stack = (exception?.stack as string) || '';
      this.logger.error({ ...logCtx, stack }, `5xx: ${exception?.name || 'Error'}: ${exception?.message}`);
    }

    // 3) 把 requestId 透出到响应（不破坏既有字段；新增 requestId）
    // R27 统一响应格式（2026-09-29）：失败响应也包成 {code, message, data:null, requestId}
//     code 用 HTTP status*1000（如 400→4000, 401→4001），让前端能区分业务错误码
//     注意：JWT 鉴权失败的 401 也走这里，但前端 axios 拦截器会识别状态码 → 跳 login
const codeMap: Record<number, number> = {
  400: 4000, // BadRequest
  401: 4001, // Unauthorized
  403: 4003, // Forbidden
  404: 4004, // NotFound
  409: 4009, // Conflict
  422: 4022, // UnprocessableEntity
  500: 5000, // InternalServerError
  503: 5003, // ServiceUnavailable
};

function extractMessage(body: any, fallback: string): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
  if (body && typeof body === 'object' && typeof body.error === 'string') return body.error;
  return fallback;
}

if (body && typeof body === 'object' && !Array.isArray(body)) {
      body.requestId = reqId;
    }

    // 4) 兜底写一次响应头（main.ts 中间件也会写；这里再写一次保证未走中间件的路径也能拿到）
    res.setHeader('X-Request-Id', reqId);

    // 5) R27 统一失败响应格式
    res.status(status).json({
      code: codeMap[status] || status,
      message: extractMessage(body, isHttp ? exception.message : 'Internal server error'),
      data: null,
      requestId: reqId,
    });
  }
}