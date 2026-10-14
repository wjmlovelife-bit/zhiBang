/**
 * request-context.ts — 单次 HTTP 请求的轻量上下文（13 项 RequestId 落地）
 *
 * 设计：
 * - 用 Node.js 原生 AsyncLocalStorage 持有 request 级元数据，**无需每个函数显式传参**。
 * - 中间件在请求开始时通过 run() 注入；业务代码（service/filter/interceptor）任何地方都能 getCurrent() 取到。
 * - 取不到时返回空对象（兜底），不会抛错影响正常流程。
 *
 * 用法：
 *   import { requestContext } from '../common/request-context';
 *   // 中间件：
 *   requestContext.run({ requestId }, () => next());
 *   // 业务/异常日志：
 *   const { requestId } = requestContext.get();
 *   this.logger.error(`[req=${requestId}] xxx failed`);
 *
 *  Node 22 下 AsyncLocalStorage 已被 V8 充分优化，性能开销可忽略。
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  /** 前端注入或后端生成的 X-Request-Id（与 req.headers['x-request-id'] 一致） */
  requestId?: string;
  /** 用户 id（auth guard 后注入），便于日志直接定位到人 */
  userId?: number;
  username?: string;
  /** R16 P1-2：客户端 IP（trust proxy 未配置时 = 127.0.0.1 或代理 IP）*/
  ip?: string;
  /** R16 P1-2：User-Agent 截断 500 字符 */
  userAgent?: string;
  /** 请求方法 + 路径（便于看日志一眼定位接口） */
  method?: string;
  path?: string;
}

class RequestContext {
  private als = new AsyncLocalStorage<RequestContextData>();

  /** 在中间件/拦截器里包一层，进入"请求作用域" */
  run<T>(data: RequestContextData, fn: () => T): T {
    return this.als.run({ ...data }, fn);
  }

  /** 取当前请求上下文；找不到返回 {}（兜底，非抛错） */
  get(): RequestContextData {
    return this.als.getStore() ?? {};
  }

  /** 取 requestId（找不到返回 '-'，方便日志统一格式） */
  getRequestId(): string {
    return this.get().requestId ?? '-';
  }

  /** 在请求作用域里补充/覆盖字段（如 auth guard 后回填 userId） */
  patch(patch: Partial<RequestContextData>): void {
    const cur = this.als.getStore();
    if (cur) Object.assign(cur, patch);
  }
}

export const requestContext = new RequestContext();