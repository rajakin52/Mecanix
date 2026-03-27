import { Module } from '@nestjs/common';
import { EstimatesController, PublicEstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EstimatesController, PublicEstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
