import { Module } from '@nestjs/common';
import { EstimatesController, PublicEstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { DeferredServicesController } from './deferred.controller';
import { DeferredServicesService } from './deferred.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EstimatesController, PublicEstimatesController, DeferredServicesController],
  providers: [EstimatesService, DeferredServicesService],
  exports: [EstimatesService, DeferredServicesService],
})
export class EstimatesModule {}
