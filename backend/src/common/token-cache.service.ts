// JWT 校验用 token-version 内存缓存
// 设计目标：
//   - 减少 JWT 校验时对 SysUser 表的查询（命中时 0 SQL）
//   - 支持"权限变更后强制重登"：admin 改密/改角色时让 SysUser.tokenVersion++，
//     JWT 内嵌的旧值与缓存不一致 → 校验失败
//   - 单进程 in-memory cache，重启即清空（无副作用，cache miss 自然走 DB 重建）
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface TokenInfo {
  isActive: boolean;
  isAdmin: boolean;
  /** SysUser.tokenVersion 当前值（与 JWT payload.tv 对比）*/
  tv: number;
  /** 本条缓存的更新时间（用于 TTL 过期）*/
  updatedAt: number;
}

@Injectable()
export class TokenCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenCacheService.name);
  private cache = new Map<number, TokenInfo>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 分钟 TTL（冷数据自动失效）
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 每分钟清理一次过期（避免长期不活跃用户 token 残留）
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
    // Node 默认 keep-alive，interval 不阻止进程退出；这里 unref() 让它不挂住进程
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  get(userId: number): TokenInfo | undefined {
    const entry = this.cache.get(userId);
    if (!entry) return undefined;
    if (Date.now() - entry.updatedAt > this.TTL_MS) {
      this.cache.delete(userId);
      return undefined;
    }
    return entry;
  }

  set(userId: number, info: Omit<TokenInfo, 'updatedAt'>): void {
    this.cache.set(userId, { ...info, updatedAt: Date.now() });
  }

  /** 主动失效某用户的缓存（admin 改密/改权限/禁用时调用，下一次请求会重新查 DB）*/
  invalidate(userId: number): void {
    this.cache.delete(userId);
  }

  /** 清空所有缓存（一般用于测试或紧急情况）*/
  clear(): void {
    this.cache.clear();
  }

  /** 当前缓存的用户数（监控用）*/
  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.cache.entries()) {
      if (now - v.updatedAt > this.TTL_MS) {
        this.cache.delete(k);
        removed++;
      }
    }
    if (removed > 0) this.logger.debug(`TokenCache cleanup removed ${removed} stale entries`);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}