import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContractService } from './contract.service';

@ApiTags('销售合同')
@Controller('contract')
@UseGuards(JwtAuthGuard)
export class ContractController {
  constructor(private svc: ContractService) {}

  @Get('next-code')
  nextCode() {
    return this.svc.nextCode();
  }

  @Get('list')
  list(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(Number(id));
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
  remove(@Param('id') id: string) {
    return this.svc.remove(Number(id));
  }

  @Get('pdf/:id')
  async pdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response) {
    try {
      const buf = await this.svc.generatePdf(Number(id));
      const fname = `合同-${id}.pdf`;
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
}
