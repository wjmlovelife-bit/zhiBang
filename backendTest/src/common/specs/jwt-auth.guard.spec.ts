/**
 * JwtAuthGuard 单元测试（覆盖 common/guards/jwt-auth.guard.ts）
 *
 * 真实自定义逻辑只有一处：@Public 装饰器短路返回 true；其余委托给 passport 的 AuthGuard('jwt')。
 * 这里通过 jest.mock('@nestjs/passport') 提供可控的父守卫，模拟 passport 对 token 的校验，
 * 从而验证「@Public 短路」与「非 public 时正确委托给 passport（由其决定放行/401）」。
 * （passport 真实策略本身由集成测试覆盖。）
 */
jest.mock('@nestjs/passport', () => {
  const { UnauthorizedException } = require('@nestjs/common') as typeof import('@nestjs/common');
  return {
    AuthGuard: jest.fn(() => {
      return class {
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          const h = req?.headers?.authorization || req?.headers?.Authorization;
          if (!h) throw new UnauthorizedException();
          if (!h.startsWith('Bearer ')) throw new UnauthorizedException();
          if (h === 'Bearer expired') throw new UnauthorizedException();
          return true;
        }
      };
    }),
  };
});

import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

function setup(isPublic: boolean, headers: any) {
  const reflector = { getAllAndOverride: () => isPublic } as any;
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
  return { reflector, context };
}

describe('JwtAuthGuard', () => {
  it('1. @Public 短路 → 返回 true（不查 token）', () => {
    const { reflector, context } = setup(true, {});
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('2. 无 Authorization header → 抛 UnauthorizedException', () => {
    const { reflector, context } = setup(false, {});
    const guard = new JwtAuthGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('3. Bearer 格式错误 → 抛 UnauthorizedException', () => {
    const { reflector, context } = setup(false, { authorization: 'Token xxx' });
    const guard = new JwtAuthGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('4. token 过期 → 抛 UnauthorizedException', () => {
    const { reflector, context } = setup(false, { authorization: 'Bearer expired' });
    const guard = new JwtAuthGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('5. 合法 Bearer → 委托 passport 返回 true', () => {
    const { reflector, context } = setup(false, { authorization: 'Bearer valid-token' });
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
