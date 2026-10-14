/**
 * 前端远程日志上报工具（R15 P1-3.6）
 * - 用 navigator.sendBeacon 异步非阻塞发送
 * - 内容：原始 body 全部透传（按用户决策：不做白名单、不限流）
 * - 后端 @Body() 接收后直接进 pino，加 source: 'frontend' 字段便于 grep
 *
 * 用法：
 *   import { report } from '@/utils/report';
 *   report('error', 'something failed', { extra: 'info' });
 */
export function report(level: 'info' | 'warn' | 'error', msg: string, extra?: any) {
  try {
    const payload = JSON.stringify({
      level,
      msg,
      ts: Date.now(),
      route: location.pathname,
      extra,
    });
    // sendBeacon 是浏览器原生 API：异步、跨域安全、保证页面卸载前发送完
    // 返回 true/false：浏览器是否接受（队列满则 false，但不会抛错）
    navigator.sendBeacon('/api/frontend-log', payload);
  } catch {
    // 任何异常静默（不阻塞主流程）
  }
}