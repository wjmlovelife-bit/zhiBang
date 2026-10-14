import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import compression from 'compression';
import etag from 'etag';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LoggingExceptionFilter } from './common/filters/logging-exception.filter';
import { requestContext } from './common/request-context';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  // bufferLogs: 让启动日志缓冲，等 nestjs-pino 初始化完一并 flush
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // 替换 Nest 内置 Logger → pinoLogger（InstanceLoader 等日志都走 pino 文件）
  app.useLogger(app.get(NestPinoLogger));

  // ===== 4.2 gzip 中间件（必须在最前面，所有响应体经它）=====
  // - threshold 1024：>1KB 才压缩（小 JSON 文本压缩收益低，白白吃性能）
  // - level 6：性价比最高（1-9 越大越慢）
  // - 跳过 text/event-stream（SSE / 长连接），压缩会破坏流式响应
  app.use(
    compression({
      threshold: 1024,
      level: 6,
      filter: (req, res) => {
        const accept = req.headers['accept'];
        if (typeof accept === 'string' && accept.includes('text/event-stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ===== 4.3 ETag / 304 协商缓存（必须包装 res.json：NestJS controller 默认用 res.json）=====
  // - 同一接口重复请求：浏览器自动带 If-None-Match，服务端算 ETag 比较，命中直接 304 无 body
  // - 304 也算响应，pino HTTP 仍会记录
  app.use((req: any, res: any, next: any) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const tag = etag(bodyStr);
      res.setHeader('ETag', tag);
      if (req.headers['if-none-match'] === tag) {
        res.status(304).end();
        return res;
      }
      return originalJson(body);
    };
    next();
  });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  // uploads 目录的访问统一走 UploadController（处理中文文件名 + 强制下载响应头）
  // 不再用静态中间件暴露，避免覆盖 controller 的 Content-Disposition
  // 提供前端构建产物（dist）的静态访问：本机用 3001 端口即可直接打开页面，绕过 5173 代理/空白页问题
  const frontendDist = join(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
    app.use((req: any, res: any, next: any) => {
      // SPA 回退：非 /api、非 /upload 的 GET 请求统一返回 index.html
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/upload')) {
        res.sendFile(join(frontendDist, 'index.html'));
      } else {
        next();
      }
    });
  } else {
    console.warn('[warn] frontend/dist not found, skip serving SPA. Run `npm run build` in frontend.');
  }

  // ===== 13. RequestId 链路追踪中间件（2026-09-23 加）=====
  // 1) 优先取前端在 request.ts:12 注入的 X-Request-Id；缺失则本地 randomUUID 生成。
  // 2) 用 AsyncLocalStorage 包一层（requestContext.run），后续 service/filter/interceptor
  //    任何地方都能 getCurrent().requestId 取到同一次请求的同一个 ID。
  // 3) 把 ID 回写到响应头（X-Request-Id），前端 Network 面板可直接复制，便于线上 grep 日志。
  // 4) 关键：req.id = requestId，让 nestjs-pino 用同一个 ID（带 srv- 前缀），保证 grep 一致
  app.use((req: any, res: any, next: any) => {
    const requestId =
      (req.headers['x-request-id'] as string) || `srv-${randomUUID()}`;
    req.requestId = requestId;
    req.id = requestId; // nestjs-pino 自动从此字段读
    res.setHeader('X-Request-Id', requestId);
    requestContext.run(
      { requestId, method: req.method, path: req.originalUrl || req.url },
      () => next(),
    );
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: false, transform: true, forbidUnknownValues: false }),
  );
  // 全局异常过滤器由 app.module.ts 的 APP_FILTER provider 注册（Nest 自动注入 PinoLogger）

  // ===== Swagger API 文档（2026-09-22 加）=====
  // 访问 http://localhost:3001/api/docs 看 OpenAPI UI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('智邦 CRM API')
    .setDescription('智邦 CRM 后端接口文档（NestJS + Prisma）')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc);

  await app.listen(3001);
  const appLogger = app.get(NestPinoLogger);
  appLogger.log(`zhibang backend listening on http://localhost:3001/api`);
  appLogger.log(`Swagger UI:                http://localhost:3001/api/docs`);
  appLogger.log(`logs dir:                  ${join(process.cwd(), 'logs')}`);
  // Prisma 连接已就绪（PrismaService.onModuleInit 触发 $connect；连接失败会在那里抛）
  appLogger.log(`Prisma client:             connected`);
}
bootstrap();