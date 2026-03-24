import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  controllers: [LeadsController, ActivitiesController],
  providers: [LeadsService, ActivitiesService],
  exports: [LeadsService, ActivitiesService],
})
export class CrmModule {}
