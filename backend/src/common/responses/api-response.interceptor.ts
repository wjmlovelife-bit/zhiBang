/**
 * 统一响应格式 Interceptor（R27 2026-09-29）
 * - 拦截所有 controller 成功返回，包成 {code:0, message:'ok', data:<原>, requestId}
 * - HTTP 状态码保持原样（200/201 等）
 * - 业务错误码统一在 code 字段（前端可读这个判断，不依赖 HTTP 状态）
 *
 * 设计取舍：
 * - 用 data 包装保持向后兼容（前端只要取 res.data.data 即可）
 * - 不改 controller，让 service 保持纯净（透传返回原数据）
 * - 失败响应在 LoggingExceptionFilter 单独包，与本 interceptor 解耦
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { requestContext } from '../request-context';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const ctx = requestContext.get();
        // data 为 undefined 时也返回 null（前端统一从 res.data.data 取，避免 undefined 报错）
        const payload = data === undefined ? null : data;
        return {
          code: 0,
          message: 'ok',
          data: payload,
          requestId: ctx?.requestId ?? null,
        };
      }),
    );
  }
}