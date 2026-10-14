import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @IpAddress() - controller 参数装饰器（R16 P1-2）
 * 用法：async login(@IpAddress() ip: string, ...) { ... }
 * 备注：trust proxy 未配置时 IP 会是 127.0.0.1 或代理 IP（R16 用户决策不配 trust proxy）
 */
export const IpAddress = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return (req.ip || req.socket?.remoteAddress || '').toString();
  },
);