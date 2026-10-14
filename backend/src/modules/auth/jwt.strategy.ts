import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCacheService, TokenInfo } from '../../common/token-cache.service';

/**
 * JWT 校验策略（R32 方案C 优化版）
 * 设计要点：
 *   1. JWT payload 已内嵌 snapshot：permissions / roleCodes / dataScope / isAdmin / tv
 *   2. validate 流程：JWT 解码 → payload 直接拿 permissions（0 SQL）
 *   3. 仅在 cache miss / cache 失效时查 DB 拿 isActive + isAdmin + tokenVersion
 *   4. tokenVersion 校验：JWT 内 tv 必须 === 缓存中 tv，否则 401（强制重登）
 *   5. cache 由 setInterval 定期清理 5 分钟未访问的条目
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private tokenCache: TokenCacheService,
  ) {
    super({
      // 优先取 Authorization 头；浏览器直接请求 PDF(iframe/新标签) 无法带 header，允许通过 ?token= 附带
      jwtFromRequest: (req: any) => {
        const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (fromHeader) return fromHeader;
        if (req && req.query && req.query.token) return req.query.token as string;
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: 'zhibang-jwt-secret-change-in-prod',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) throw new UnauthorizedException('无效 token');

    // 步骤 1：从内存缓存取 tokenVersion / isActive / isAdmin
    let cached: TokenInfo | undefined = this.tokenCache.get(payload.sub);
    if (!cached) {
      // cache miss → 1 SQL 加载最小集
      const u = await this.prisma.sysUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, isAdmin: true, tokenVersion: true },
      });
      if (!u) throw new UnauthorizedException('用户不存在');
      if (!u.isActive) throw new UnauthorizedException('账号已禁用');
      this.tokenCache.set(payload.sub, { isActive: u.isActive, isAdmin: u.isAdmin, tv: u.tokenVersion });
      cached = this.tokenCache.get(payload.sub);
    } else if (!cached.isActive) {
      // 缓存命中但已禁用（理论上不会发生，因为禁用时 tokenCache.invalidate 已清理）
      throw new UnauthorizedException('账号已禁用');
    }

    // 步骤 2：tokenVersion 校验（核心 - 强制权限变更生效）
    if (payload.tv !== cached.tv) {
      console.log(`[JwtStrategy] sub=${payload.sub} TV MISMATCH: payload.tv=${payload.tv} cached.tv=${cached.tv}`);
      throw new UnauthorizedException('权限已变更，请重新登录');
    }

    // 步骤 3：直接用 payload 的 snapshot 返回（0 SQL）
    // 注意：deptId / deptName / roles 数组可能缺失（旧 token 无这些字段），前端可容忍
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      deptId: payload.deptId,
      deptName: payload.deptName,
      isAdmin: cached.isAdmin || !!payload.isAdmin,
      roleCodes: payload.roleCodes || [],
      dataScope: typeof payload.dataScope === 'number' ? payload.dataScope : 4,
      permissions: payload.permissions || [],
      roles: payload.roles || [],
    };
  }
}
