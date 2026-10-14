import { Module } from '@nestjs/common';
import { SysController } from './sys.controller';
import { SysService } from './sys.service';
import { TokenCacheService } from '../../common/token-cache.service';

@Module({
  controllers: [SysController],
  providers: [SysService, TokenCacheService],
  exports: [SysService],
})
export class SysModule {}
