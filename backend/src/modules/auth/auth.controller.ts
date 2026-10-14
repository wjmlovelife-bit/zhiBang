import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // 全局 ValidationPipe 会基于 LoginDto 自动校验：
    // - 空 body → 400（username/password 不能为空）
    // - NoSQL 注入 { $ne: null } → 400（必须是 string）
    // - 长度超限 → 400
    const ip = (req.ip || req.socket.remoteAddress || '').toString();
    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);
    return this.auth.login(body.username, body.password, ip, userAgent);
  }

  // 用户确认"密码已被重置"提示后调此接口清除标记位（仅对自己；userId 从 JWT 取）
  @Post('clear-password-flag')
  async clearPasswordFlag(@CurrentUser() user: any) {
    return this.auth.clearPasswordFlag(user.id);
  }
}
