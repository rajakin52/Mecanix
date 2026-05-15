import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { CronController } from './cron.controller';
import { WebhookController } from './webhook.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => PurchaseRequestsModule)],
  controllers: [NotificationsController, CronController, WebhookController, ResendWebhookController],
  providers: [NotificationsService, WhatsAppService, SmsService, PushService, EmailService],
  exports: [NotificationsService, WhatsAppService, SmsService, PushService, EmailService],
})
export class NotificationsModule {}
