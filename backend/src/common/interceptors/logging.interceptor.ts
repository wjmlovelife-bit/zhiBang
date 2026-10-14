/**
 * 全局 LoggingInterceptor（R15 P1-3.7）
 * - 成功路径：info 级别（duration > 阈值升 warn）
 * - 失败路径：error 级别（不打印 stack——LoggingExceptionFilter 已处理）
 * - 异常路径：catchError + throwError 不吞错（throwError(() => err) 重新抛）
 * - 拦截器顺序：必须在 OperLogInterceptor 之前注册（洋葱模型：先注册的后执行）
 *
 * 不做的事：
 * - 不写 stack（filter 已写，避免重复）
 * - 不吞错（catchError 必须 throwError(() => err)）
 * - 不做业务审计（由 OperLogInterceptor 负责）
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { THRESHOLDS } from '../config/thresholds';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@InjectPinoLogger(LoggingInterceptor.name) private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const t0 = Date.now();
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.originalUrl || req.url;

    return next.handle().pipe(
      tap(() => {
        const dur = Date.now() - t0;
        const ctx = { method, url, dur, status: 'success' };
        if (dur > THRESHOLDS.slowRequest) {
          this.logger.warn({ ...ctx, threshold: THRESHOLDS.slowRequest }, 'slow request');
        } else {
          this.logger.info(ctx, 'request done');
        }
      }),
      catchError((err) => {
        const dur = Date.now() - t0;
        this.logger.error({ method, url, dur, err: err?.message, name: err?.name }, 'request failed');
        // 不吞错：必须 throwError(() => err) 重新抛，让 Nest 异常管道继续处理
        return throwError(() => err);
      }),
    );
  }
}