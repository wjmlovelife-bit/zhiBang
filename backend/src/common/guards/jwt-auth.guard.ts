import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { requestContext } from '../request-context';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    // 14. JWT 验证成功后，把 userId/username 注入 RequestContext（service 日志可直接用）
    const req = context.switchToHttp().getRequest();
    const ok = super.canActivate(context);
    if (ok && req?.user) {
      requestContext.patch({
        userId: req.user.id,
        username: req.user.username,
        // R16 P1-2：注入 IP + UA 到 ALS，service 可 requestContext.get() 取
        ip: req.ip || req.socket?.remoteAddress || '',
        userAgent: (req.headers['user-agent'] || '').slice(0, 500),
      });
    }
    return ok;
  }
}
