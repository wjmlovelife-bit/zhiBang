import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectService } from './project.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('项目')
@Controller('project')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private svc: ProjectService) {}

  @Get('next-code')
  nextCode() {
    return this.svc.nextCode();
  }

  @Get('search-customer')
  searchCustomer(@Query('keyword') keyword: string, @CurrentUser() user: any) {
    return this.svc.searchCustomer(keyword, user);
  }

  @Get('search-contract')
  searchContract(@Query('keyword') keyword: string) {
    return this.svc.searchContract(keyword);
  }

  @Post('import-preview')
  importPreview(@Body() body: { rows: any[] }) {
    return this.svc.importPreview(body.rows || []);
  }

  @Post('import-confirm')
  importConfirm(@Body() body: { rows: any[] }, @CurrentUser() user: any) {
    return this.svc.importConfirm(body.rows || [], user);
  }

  @Get('export')
  async export(@Query('ids') ids: string, @Res() res: Response) {
    const idArr = ids ? ids.split(',').map((x) => Number(x)).filter(Boolean) : undefined;
    const rows = await this.svc.exportCsv(idArr);
    const header = ['项目编号', '项目主题', '客户编号', '主负责人', '项目分类', '项目阶段', '项目来源', '项目状态', '发现日期', '优惠后总额'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.code, r.name, r.customerCode, r.owner?.name || '', r.category, r.stage, r.source, r.state,
        r.dateOpen ? new Date(r.dateOpen).toISOString().slice(0, 10) : '', r.amountFinal,
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
    res.send('﻿' + lines.join('\n'));
  }

  @Get('pdf/:id')
  async pdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response) {
    try {
      const buf = await this.svc.generatePdf(Number(id));
      const fname = `项目-${id}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fname)}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      );
      res.send(buf);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'PDF 生成失败' });
    }
  }

  @Get('list')
  list(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(Number(id));
  }

  @Get(':id/follow')
  follows(@Param('id') id: string) {
    return this.svc.detail(Number(id)).then((d) => d.follows);
  }

  @Post(':id/follow')
  addFollow(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.svc.addFollow(Number(id), body, user);
  }

  @Put(':id/follow/:followId')
  updateFollow(
    @Param('id') id: string,
    @Param('followId') followId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.svc.updateFollow(Number(id), Number(followId), body, user);
  }

  @Delete(':id/follow/:followId')
  deleteFollow(
    @Param('id') id: string,
    @Param('followId') followId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.deleteFollow(Number(id), Number(followId), user);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.create(body, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.svc.update(Number(id), body, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(Number(id), user);
  }

  @Post(':id/inherit')
  inherit(
    @Param('id') id: string,
    @Body() body: { toUserId: number; reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.svc.inherit(Number(id), body.toUserId, body.reason || '', user);
  }
}
