import { Module } from '@nestjs/common';
import { WeeklyScheduleController } from './weekly-schedule.controller';
import { WeeklyScheduleService } from './weekly-schedule.service';

@Module({
  controllers: [WeeklyScheduleController],
  providers: [WeeklyScheduleService],
  exports: [WeeklyScheduleService],
})
export class WeeklyScheduleModule {}