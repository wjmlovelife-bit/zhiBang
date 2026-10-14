import { Module } from '@nestjs/common';
import { SalesScheduleController } from './sales-schedule.controller';
import { SalesScheduleService } from './sales-schedule.service';

@Module({
  controllers: [SalesScheduleController],
  providers: [SalesScheduleService],
})
export class SalesScheduleModule {}