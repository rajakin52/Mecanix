import { Module } from '@nestjs/common';
import { AppointmentsController, PublicRescheduleController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  controllers: [AppointmentsController, PublicRescheduleController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
