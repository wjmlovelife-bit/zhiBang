import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from '@nestjs/cache-manager';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { PdfModule } from './common/pdf/pdf.module';
import { AuthModule } from './modules/auth/auth.module';
import { SysModule } from './modules/sys/sys.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProjectModule } from './modules/project/project.module';
import { QuotationModule } from './modules/quotation/quotation.module';
import { ContractModule } from './modules/contract/contract.module';
import { WorkLogModule } from './modules/worklog/worklog.module';
import { UploadModule } from './modules/upload/upload.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { FollowModule } from './modules/follow/follow.module';
import { WeeklyScheduleModule } from './modules/weekly-schedule/weekly-schedule.module';
import { SalesScheduleModule } from './modules/sales-schedule/sales-schedule.module';
import { StatsModule } from './modules/stats/stats.module';
import { FrontendLogModule } from './modules/frontend-log/frontend-log.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { LoggingExceptionFilter } from './common/filters/logging-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiResponseInterceptor } from './common/responses/api-response.interceptor';
import { OperLogInterceptor } from './common/interceptors/oper-log.interceptor';

@Module({
  imports: [
    // 4.1 全局 in-memory 缓存（不依赖 Redis；重启即失效）
    //    - 默认 TTL 60s（每个 service 可在 cache.set 时单独指定）
    //    - 最大 1000 个 key（LRU 淘汰，超出后旧 key 被覆盖）
    //    - isGlobal: true → 所有 module 不用再单独 import，直接 @Inject(CACHE_MANAGER) 即可
    //    - service 写入时调用 cache.del(key) 精确失效；不建议用 cache.reset()（会清空所有模块缓存）
    CacheModule.register({
      ttl: 60_000,
      max: 1000,
      isGlobal: true,
    }),
    // 13. 结构化日志：pino + pino-roll 按天滚动落盘到 backend/logs/zhibang-yyyy-MM-dd.log
    //    保留 7 天 + gzip 压缩；reqId 由 main.ts 中间件写入 req.id，与前端 toast 显示一致（带 srv- 前缀）
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        // R14.3 修：pino 自己生成带 srv- 前缀的 reqId，不再依赖 main.ts 中间件先跑
        // 1) 优先取前端 X-Request-Id（与前端 uuid 一致）
        // 2) 没有就本地生成 srv-{uuid}
        // 3) **兜底**：收到的 id 没有 srv- 前缀也强制加（兼容旧前端 / curl 测试）
        // 与 req.id 同步中间件保持一致（main.ts 那份可保留作冗余 / 响应头）
        genReqId: (req) => {
          const hdr = req.headers['x-request-id'];
          let id = (typeof hdr === 'string' && hdr) ? hdr : `srv-${require('crypto').randomUUID()}`;
          if (!id.startsWith('srv-')) id = `srv-${id}`;
          return id;
        },
        transport: {
          targets: [
            // 控制台（stdout）
            {
              target: 'pino/file',
              options: { destination: 1 },
            },
            // 文件滚动（绝对路径避开 worker thread 包名解析问题）
            {
              target: require.resolve('pino-roll'),
              options: {
                file: join(process.cwd(), 'logs', 'zhibang'),
                frequency: 'daily',
                extension: '.log',
                dateFormat: 'yyyy-MM-dd',
                mkdir: true,
                // 保留 7 天后自动压缩 + 删除
                limit: { count: 7 },
                // gzip 压缩历史文件
                gzip: true,
              },
            },
          ],
        },
        // 序列化为单行 JSON（默认就是 JSON，这里显式声明便于 grep）
        // 注意：pino transport targets 模式下不能用 formatters.level（会报错）；level 字段用默认数字即可
        // 自定义日志字段：把 main.ts 写的 req.id 直接当 reqId 输出（保持带 srv- 前缀）
        customProps: (req) => ({ reqId: (req as any).id }),
      },
    }),
    PrismaModule,
    PdfModule,
    AuthModule,
    SysModule,
    CustomerModule,
    ProjectModule,
    QuotationModule,
    ContractModule,
    WorkLogModule,
    UploadModule,
    InventoryModule,
    PurchaseModule,
    FollowModule,
    WeeklyScheduleModule,
    SalesScheduleModule,
    StatsModule,
    FrontendLogModule,
  ],
  providers: [
    // 全局异常过滤器：用 APP_FILTER 注册，让 Nest 通过 DI 注入 PinoLogger
    // （不要在 main.ts 里 app.get('PinoLogger')，那个 token 是错的；正确方式是用 APP_FILTER）
    { provide: APP_FILTER, useClass: LoggingExceptionFilter },
    // R15 全局 LoggingInterceptor：成功/失败/慢请求日志
    //     必须在 OperLogInterceptor 之前注册（Nest 洋葱模型：先注册的后执行 = 内层）
    //     catchError + throwError(() => err) 兜底避免阻塞主流程
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // 14. 全局业务审计 Interceptor：POST/PUT/PATCH/DELETE 成功/失败 → 写 SysOperLog
    //     try/catch 兜底避免阻塞主流程
    { provide: APP_INTERCEPTOR, useClass: OperLogInterceptor },
    // R27 统一响应格式 Interceptor（2026-09-29）：包 {code:0, message, data, requestId}
    //     必须在 LoggingInterceptor 之后注册（Nest 洋葱模型：先注册的后执行 = 内层），
    //     这样 LoggingInterceptor 先看到原始 controller 返回值（更易调试），
    //     然后由 ApiResponseInterceptor 包装后返回给客户端
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    // 全局守卫顺序：先 JWT 鉴权填充 req.user，再校验操作权限；@Public() 跳过鉴权
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
