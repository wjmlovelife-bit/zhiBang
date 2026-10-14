import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { THRESHOLDS } from '../common/config/thresholds';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@InjectPinoLogger('PrismaService') private readonly logger: PinoLogger) {
    super();
  }
  async onModuleInit() {
    const t0 = Date.now();
    try {
      // 慢查询监听（默认 level=info 时不打所有 query；只 warn 慢查询；debug 模式全打）
      // 注意：必须在 $connect 前注册，否则启动期的 connect 也会被监听到
      // Prisma 的 $on 类型对 'query' 事件不导出，使用 any 绕过
      (this as any).$on('query', (e: any) => {
        const dur = e.duration ?? 0;
        if (dur > THRESHOLDS.slowQuery) {
          // 慢查询无论 level 都 warn（永远能定位）
          this.logger.warn({ dur, sql: e.query, params: e.params, threshold: THRESHOLDS.slowQuery }, 'slow query');
        } else if (this.shouldLogQuery()) {
          // 普通 query 仅 debug/trace 模式打
          this.logger.debug({ dur, sql: e.query }, 'query');
        }
      });
      await this.$connect();
      this.logger.info({ took: Date.now() - t0 }, 'Prisma connect ok');
    } catch (err: any) {
      this.logger.error({ err: err?.message, stack: err?.stack }, 'Prisma connect FAILED');
      throw err;
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  // 判断当前 logger level 是否要输出 query 日志（trace=10, debug=20）
  private shouldLogQuery(): boolean {
    const lvl = (this.logger as any).level || 30;
    return lvl <= 20;
  }
}
