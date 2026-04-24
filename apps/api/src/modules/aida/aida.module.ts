import { Module } from '@nestjs/common';
import { AidaController, AidaStatsController, PublicAidaCaptureController } from './aida.controller';
import { AidaService } from './aida.service';
import { JobsModule } from '../jobs/jobs.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JobsModule, AiModule, NotificationsModule],
  controllers: [AidaController, AidaStatsController, PublicAidaCaptureController],
  providers: [AidaService],
  exports: [AidaService],
})
export class AidaModule {}
