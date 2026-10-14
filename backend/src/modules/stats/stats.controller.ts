import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import type { Response } from 'express';
import { buildContentDisposition } from '../../common/utils/content-disposition';

/**
 * 销售数据统计
 * - GET /api/stats/sales-summary：JSON 概览（指标卡 + 人员明细）
 * - GET /api/stats/sales-export：Excel 导出（导出全部=perUser 全部行；导出某条 = 单人 = 单行）
 *
 * 权限：仅 admin（isAdmin=true 短路 + stats:view/stats:export 守卫）
 */
@ApiTags('数据统计')
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private svc: StatsService) {}

  @Get('sales-summary')
  @Permissions('stats:view')
  async summary(
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.summary({
      userId: userId ? Number(userId) : undefined,
      dateFrom,
      dateTo,
    });
  }

  @Get('sales-export')
  @Permissions('stats:export')
  async exportExcel(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const buf = await this.svc.buildExcel({
      userId: userId ? Number(userId) : undefined,
      dateFrom,
      dateTo,
    });
    const filename = `销售数据统计_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', buildContentDisposition(filename));
    res.end(buf);
  }
}