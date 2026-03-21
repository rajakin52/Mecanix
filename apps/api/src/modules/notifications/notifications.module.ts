import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [NotificationsController, WebhookController],
  providers: [NotificationsService, WhatsAppService],
  exports: [NotificationsService, WhatsAppService],
})
export class NotificationsModule {}
