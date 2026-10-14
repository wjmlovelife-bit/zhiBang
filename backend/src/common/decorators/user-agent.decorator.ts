import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @UserAgent() - controller 参数装饰器（R16 P1-2）
 * 用法：async login(@UserAgent() ua: string, ...) { ... }
 * 截断 500 字符防超大 UA 撑爆日志
 */
export const UserAgent = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return (req.headers['user-agent'] || '').toString().slice(0, 500);
  },
);