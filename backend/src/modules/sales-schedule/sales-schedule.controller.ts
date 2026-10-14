import { Controller, Get, Put, Query, Body, UseGuards, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SalesScheduleService } from './sales-schedule.service';
import { ApiTags } from '@nestjs/swagger';
import { buildContentDisposition } from '../../common/utils/content-disposition';

@ApiTags('销售日程')
@Controller('sales-schedule')
@UseGuards(JwtAuthGuard)
export class SalesScheduleController {
  constructor(private svc: SalesScheduleService) {}

  /** 拉某周日程：管理员可指定 ownerId，其他人固定 ownerId=自己 */
  @Get()
  async get(
    @Query('weekStart') weekStart: string,
    @Query('ownerId') queryOwnerId: string,
    @CurrentUser() user: any,
  ) {
    if (!weekStart) {
      return { ownerId: user.id, weekStart: null, weekEnd: null, planText: '', summaryText: '', leaderComment: '', days: [] };
    }
    const isAdmin = !!user?.isAdmin;
    const ownerId = isAdmin && queryOwnerId ? Number(queryOwnerId) : user.id;
    const ws = new Date(weekStart + 'T00:00:00.000Z');
    return this.svc.getByWeek(ownerId, ws);
  }

  /** 保存顶部 3 段（计划/总结/评定） */
  @Put()
  upsert(@Body() body: any, @CurrentUser() user: any) {
    if (!user?.isAdmin && body.ownerId && Number(body.ownerId) !== user.id) {
      body.ownerId = user.id;
    } else if (!body.ownerId) {
      body.ownerId = user.id;
    }
    return this.svc.upsert(body);
  }

  /** 导出某周日程为 xlsx（含聚合列） */
  @Get('export')
  async export(
    @Query('weekStart') weekStart: string,
    @Query('ownerId') queryOwnerId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!weekStart) {
      throw new BadRequestException('weekStart required');
    }
    const isAdmin = !!user?.isAdmin;
    const ownerId = isAdmin && queryOwnerId ? Number(queryOwnerId) : user.id;
    const ws = new Date(weekStart + 'T00:00:00.000Z');
    const buf = await this.svc.exportToBuffer(ownerId, ws);
    const fname = `销售日程_${ws.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', buildContentDisposition(fname));
    // 用 @Res() 直接接管响应；不能 return（避免 Nest 尝试 JSON.stringify Buffer 抛 500）
    res.end(buf);
  }
}