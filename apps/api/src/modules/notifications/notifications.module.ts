import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { PushService } from './push.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController, WebhookController],
  providers: [NotificationsService, WhatsAppService, PushService],
  exports: [NotificationsService, WhatsAppService, PushService],
})
export class NotificationsModule {}
