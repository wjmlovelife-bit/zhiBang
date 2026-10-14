import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkLogService } from './worklog.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('工作日志')
@Controller('worklog')
@UseGuards(JwtAuthGuard)
export class WorkLogController {
  constructor(private svc: WorkLogService) {}

  @Get()
  list(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.list(q, user);
  }

  @Get('next-code')
  nextCode() {
    return this.svc.nextCode();
  }

  @Get('search-customer')
  searchCustomer(@Query('keyword') keyword: string, @CurrentUser() user: any) {
    return this.svc.searchCustomer(keyword, user);
  }

  @Get('search-project')
  searchProject(@Query('keyword') keyword: string, @CurrentUser() user: any) {
    return this.svc.searchProject(keyword, user);
  }

  // ============ 本周工作总结（按用户+周唯一） ============
  // ★ 字面量路由（weekly-summary / daily-report）必须放在 :id 之前，
  //   否则 NestJS 按声明顺序会把 weekly-summary 当成 :id="weekly-summary"，
  //   错配到 update/remove 方法上；同时给 :id 加数字正则双保险。
  @Get('weekly-summary')
  weeklySummary(@Query('weekStart') weekStart: string, @CurrentUser() user: any) {
    return this.svc.getWeeklySummary(user, weekStart);
  }

  @Get('weekly-summary/list')
  weeklySummaryList(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('keyword') keyword: string,
    @Query('ownerId') ownerId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.listWeeklySummaries(user, Number(page), Number(pageSize), {
      keyword,
      ownerId: ownerId ? Number(ownerId) : undefined,
      dateStart,
      dateEnd,
    });
  }

  @Put('weekly-summary')
  weeklySummarySave(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.saveWeeklySummary(user, body);
  }

  @Delete('weekly-summary/:weekStart')
  weeklySummaryDelete(@Param('weekStart') weekStart: string, @CurrentUser() user: any) {
    return this.svc.deleteWeeklySummary(user, weekStart);
  }

  // ============ 工作日报（按用户+日期唯一） ============
  @Get('daily-report/list')
  dailyReportList(@Query('limit') limit: string, @CurrentUser() user: any) {
    return this.svc.listDailyReports(user, Number(limit));
  }

  @Put('daily-report')
  dailyReportSave(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.saveDailyReport(user, body);
  }

  @Delete('daily-report/:date')
  dailyReportDelete(@Param('date') date: string, @CurrentUser() user: any) {
    return this.svc.deleteDailyReport(user, date);
  }

  // ============ 通用 :id 路由（必须是数字）放最后 =============
  @Post()
  @HttpCode(201)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.create(body, user);
  }

  // ★ 用 :id(\\d+) 限制成纯数字，防止 weekly-summary、daily-report
  //   等字面量路径被错误匹配到该路由上。
  @Get(':id(\\d+)')
  detail(@Param('id') id: string) {
    return this.svc.detail(Number(id));
  }

  @Put(':id(\\d+)')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.svc.update(Number(id), body, user);
  }

  @Delete(':id(\\d+)')
  remove(@Param('id') id: string) {
    return this.svc.remove(Number(id));
  }
}
