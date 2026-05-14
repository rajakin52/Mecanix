import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { StatementsService } from './statements.service';
import { SoaPdfService } from './soa-pdf.service';
import { SoaMailerService } from './soa-mailer.service';
import { SoaCronController } from './soa-cron.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController, SoaCronController],
  providers: [ReportsService, StatementsService, SoaPdfService, SoaMailerService],
  exports: [ReportsService, StatementsService, SoaPdfService, SoaMailerService],
})
export class ReportsModule {}
