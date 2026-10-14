/**
 * 业务审计 Interceptor（R14 补齐）
 * - 自动审计 POST/PUT/PATCH/DELETE 成功请求 → SysOperLog
 * - module/action 自动从 url + method 推断（最长前缀匹配）
 * - 兜底：写日志失败 try/catch 吞掉，不阻塞业务
 * - 跳过 GET（高频查询不审计，避免日志爆盘）
 * - 跳过 /api/auth/login 自身（避免循环——登录审计由 auth.service 单独写 SysLoginLog）
 * - 跳过 /api/upload（上传文件有大 body，detail 字段不写）
 *
 * 不做的事：
 * - IP 字段暂不写（trust proxy 未配，可能全 127.0.0.1，等单独 PR）
 * - 第三方远程上报（高频风险，等单独 PoC）
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { inferModule, inferAction } from '../utils/module-action-dict';
import { requestContext } from '../request-context';

@Injectable()
export class OperLogInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(OperLogInterceptor.name) private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.originalUrl || req.url;

    // 跳过 GET / HEAD / OPTIONS
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    // 跳过 auth 登录本身（认证模块单独走 SysLoginLog）
    if (url.startsWith('/api/auth/login') || url.startsWith('/api/auth/clear-password-flag')) return next.handle();

    // 跳过上传（detail 大 body 没意义）
    if (url.startsWith('/api/upload')) return next.handle();

    return next.handle().pipe(
      tap((ret) => {
        // 异步写日志（不 await，fire-and-forget）
        // 用 setImmediate 避免阻塞响应
        setImmediate(() => this.writeLog(req, method, url, 'success', ret).catch(() => {}));
      }),
      catchError((err) => {
        setImmediate(() => this.writeLog(req, method, url, 'fail', null, err).catch(() => {}));
        return throwError(() => err);
      }),
    );
  }

  private async writeLog(req: any, method: string, url: string, status: 'success' | 'fail', ret: any, err?: any) {
    try {
      const ctx = requestContext.get();
      // 提取 targetId（从 url path / id 参数）
      const idMatch = url.match(/\/(\d+)(?:\?|$|\/)/);
      const targetId = idMatch ? Number(idMatch[1]) : null;
      // 详细：响应 id + method（避免存大量 body）
      const detail = status === 'success'
        ? `targetId=${targetId ?? '-'} result=${ret?.id ?? '-'}`
        : `error=${err?.name || 'Error'}: ${err?.message || '-'}`;
      await this.prisma.sysOperLog.create({
        data: {
          userId: ctx.userId ?? null,
          username: ctx.username ?? '',
          module: inferModule(url),
          action: inferAction(method),
          targetId,
          detail: detail.slice(0, 1000),
          ip: null, // 暂不写（trust proxy 单独 PR）
        },
      });
    } catch (e: any) {
      this.logger.error({ err: e?.message, url, method }, 'failed to write SysOperLog');
    }
  }
}