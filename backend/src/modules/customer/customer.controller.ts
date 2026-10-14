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
import { CustomerService } from './customer.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('客户')
@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private svc: CustomerService) {}

  @Get('next-code')
  nextCode() {
    return this.svc.nextCode();
  }

  @Get('search')
  search(@Query('keyword') keyword: string, @CurrentUser() user: any) {
    return this.svc.search(keyword, user);
  }

  @Get('list')
  list(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(Number(id));
  }

  @Get(':id/follows')
  follows(@Param('id') id: string) {
    return this.svc.getFollows(Number(id));
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
