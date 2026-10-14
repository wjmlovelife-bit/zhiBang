import { Module } from '@nestjs/common';
import { FrontendLogController } from './frontend-log.controller';

@Module({
  controllers: [FrontendLogController],
})
export class FrontendLogModule {}