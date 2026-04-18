import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { CronController } from './cron.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => PurchaseRequestsModule)],
  controllers: [NotificationsController, CronController, WebhookController],
  providers: [NotificationsService, WhatsAppService, SmsService, PushService],
  exports: [NotificationsService, WhatsAppService, SmsService, PushService],
})
export class NotificationsModule {}
