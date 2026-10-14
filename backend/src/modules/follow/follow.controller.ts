import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FollowService } from './follow.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('跟进')
@Controller('follow')
@UseGuards(JwtAuthGuard)
export class FollowController {
  constructor(private svc: FollowService) {}

  /**
   * 取跟进记录"客户联系人"下拉池的联系人。
   * 权限校验在 service 内做（普通用户 followerId 必须等于当前用户 id；管理员豁免）。
   * GET /api/follow/contacts?followerId=X
   */
  @Get('contacts')
  contacts(@Query('followerId') followerId: string, @CurrentUser() user: any) {
    return this.svc.getContactsByFollower(Number(followerId), user);
  }
}