import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { computePermissions } from '../../common/permissions';
import { TokenCacheService } from '../../common/token-cache.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private tokenCache: TokenCacheService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  async validateUser(usernameOrName: string, password: string) {
    // 先按 username 精确匹配；查不到再按 name 精确匹配（支持用户名或姓名登录）
    const where = { OR: [{ username: usernameOrName }, { name: usernameOrName }] };
    // 多数情况 username 已 @unique，首条即命中；findFirst 防姓名理论上重复时拿不到数据
    const user = await this.prisma.sysUser.findFirst({
      where,
      include: { roles: { include: { role: true } }, dept: true },
    });
    // 密码按明文存储（seed 约定）；如改用 bcrypt 在此替换比对逻辑
    if (!user || user.password !== password) {
      this.logger.warn({ usernameOrName, hasUser: !!user }, 'login failed: invalid credentials');
      throw new UnauthorizedException('用户名或姓名或密码错误');
    }
    if (!user.isActive) {
      this.logger.warn({ userId: user.id, username: user.username }, 'login failed: account disabled');
      throw new UnauthorizedException('账号已禁用');
    }
    return user;
  }

  async login(username: string, password: string, ip: string = '', userAgent: string = '') {
    let user: any;
    try {
      user = await this.validateUser(username, password);
    } catch (e) {
      // 登录失败写 SysLoginLog（status:false）
      this.writeLoginLog(null, username, ip, userAgent, false, e?.message || 'invalid');
      throw e;
    }
    const payload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      deptId: user.deptId,
      deptName: user.dept?.name,
      isAdmin: !!user.isAdmin,
      tv: user.tokenVersion,   // R32 方案C：内嵌权限版本号，权限变更后旧 token 立即失效
      roleCodes: user.roles.map((r: any) => r.role.code),
      dataScope: user.roles.length ? Math.min(...user.roles.map((r: any) => r.role.dataScope)) : 4,
      permissions: await computePermissions(this.prisma, user),
      roles: user.roles.map((r: any) => ({
        id: r.role.id,
        code: r.role.code,
        name: r.role.name,
        dataScope: r.role.dataScope,
      })),
    };
    this.logger.info({ userId: user.id, username: user.username, roleCount: payload.roleCodes.length, dataScope: payload.dataScope, tv: payload.tv }, 'login success');
    // 登录成功写 SysLoginLog（status:true）
    this.writeLoginLog(user.id, username, ip, userAgent, true, null);
    return {
      token: this.jwt.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        deptId: user.deptId,
        deptName: user.dept?.name,
        isAdmin: !!user.isAdmin,
        roleCodes: payload.roleCodes,
        dataScope: payload.dataScope,
        permissions: payload.permissions,
        // 标记位：admin 改密后置 true，前端提示一次后调 /auth/clear-password-flag 置 false
        mustResetPassword: !!user.mustResetPassword,
      },
    };
  }

  /** 写 SysLoginLog（成功 / 失败都写；fire-and-forget，不阻塞主流程） */
  private writeLoginLog(userId: number | null, username: string, ip: string, userAgent: string, status: boolean, message: string | null) {
    setImmediate(async () => {
      try {
        await this.prisma.sysLoginLog.create({
          data: {
            userId,
            username: (username || '').slice(0, 50),
            ip: (ip || '').slice(0, 50),
            userAgent: (userAgent || '').slice(0, 500),
            status,
            message,
          },
        });
      } catch (e: any) {
        this.logger.error({ err: e?.message, userId, status }, 'failed to write SysLoginLog');
      }
    });
  }

  /**
   * 用户登录后确认"密码已被重置"提示 → 清标记位，下次登录不再提示
   * R32：同步递增 tokenVersion → 该用户所有旧 token 立即失效（强制重登）
   */
  async clearPasswordFlag(userId: number) {
    this.logger.info({ userId }, 'clearPasswordFlag');
    await this.prisma.sysUser.update({
      where: { id: userId },
      data: {
        mustResetPassword: false,
        tokenVersion: { increment: 1 },
      },
    });
    this.tokenCache.invalidate(userId); // 立即失效缓存（避免 5s 内 cache hit 旧 tv）
    return { ok: true };
  }
}
