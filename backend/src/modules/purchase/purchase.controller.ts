import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PurchaseService } from './purchase.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('采购')
@Controller('purchase')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private svc: PurchaseService) {}

  @Get('list')
  list(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.list(q, user);
  }

  @Get('export')
  export(@CurrentUser() user: any) {
    return this.svc.export(user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.detail(Number(id), user);
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
}