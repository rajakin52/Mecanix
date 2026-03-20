import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';
import { TimeService } from './time.service';
import { ClockController } from './clock.controller';
import { ClockService } from './clock.service';

@Module({
  controllers: [TimeController, ClockController],
  providers: [TimeService, ClockService],
  exports: [TimeService, ClockService],
})
export class TimeModule {}
