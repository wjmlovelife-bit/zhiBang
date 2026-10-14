/**
 * PermissionsGuard 单元测试（覆盖 common/guards/permissions.guard.ts）
 *
 * 直接实例化守卫，mock Reflector 与 ExecutionContext，无需 Nest 容器。
 */
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { ForbiddenException } from '@nestjs/common';

function makeContext(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PermissionsGuard', () => {
  it('1. admin 豁免', () => {
    const reflector = { getAllAndOverride: () => ['a:view'] } as any;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ isAdmin: true, permissions: [] }))).toBe(true);
  });

  it('2. required 命中其一 → true', () => {
    const reflector = { getAllAndOverride: () => ['c:view', 'a:view'] } as any;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ permissions: ['a:view', 'b:view'] }))).toBe(true);
  });

  it('3. required 全部不命中 → 抛 ForbiddenException', () => {
    const reflector = { getAllAndOverride: () => ['c:view'] } as any;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext({ permissions: ['a:view'] }))).toThrow(ForbiddenException);
  });

  it('4. required 空数组 → 放行', () => {
    const reflector = { getAllAndOverride: () => [] } as any;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('5. 无 user → false', () => {
    const reflector = { getAllAndOverride: () => ['a:view'] } as any;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});
