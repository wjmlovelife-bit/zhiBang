/**
 * 前端远程日志上报接收（R15）
 * - 不限流（按用户决策）
 * - 不白名单（按用户决策：@Body() 任意 JSON 透传给 pino）
 * - @Public 让未登录的前端也能上报（token 过期场景）
 * - 加 source: 'frontend' 字段，grep -E '"source":"frontend"' 区分前后端日志
 */
import { Body, Controller, Post } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Public } from '../../common/decorators/public.decorator';

@Controller('frontend-log')
export class FrontendLogController {
  constructor(@InjectPinoLogger(FrontendLogController.name) private readonly logger: PinoLogger) {}

  @Public()
  @Post()
  receive(@Body() body: any) {
    // 全部透传给 pino。body 已包含 level/msg/route/ts/extra
    this.logger.info({ source: 'frontend', ...body }, 'frontend log');
    return { ok: true };
  }
}