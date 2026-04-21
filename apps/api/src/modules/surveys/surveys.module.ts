import { Module } from '@nestjs/common';
import { SurveysController, SurveysRedirectController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { SurveysCronController } from './cron.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SurveysController, SurveysRedirectController, SurveysCronController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
