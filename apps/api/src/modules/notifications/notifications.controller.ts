import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  sendMessageSchema,
  sendTestSchema,
  registerPushTokenSchema,
  deactivatePushTokenSchema,
} from '@mecanix/validators';
import type {
  SendMessageInput,
  SendTestInput,
  RegisterPushTokenInput,
  DeactivatePushTokenInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('notifications')
@UseGuards(TenantGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  // ── Push token management ──

  @Post('push/register')
  async registerPushToken(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(registerPushTokenSchema)) body: RegisterPushTokenInput,
  ) {
    return this.pushService.registerToken(
      tenantId,
      user.id,
      body.pushToken,
      body.platform,
      body.appType,
    );
  }

  @Delete('push/token')
  async deactivatePushToken(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(deactivatePushTokenSchema)) body: DeactivatePushTokenInput,
  ) {
    return this.pushService.deactivateToken(user.id, body.pushToken);
  }

  @Post('send')
  async sendMessage(
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.notificationsService.sendCustomMessage(body.phone, body.message);
  }

  @Post('job/:jobId/created')
  async onJobCreated(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.notificationsService.onJobCreated(tenantId, jobId);
  }

  @Post('job/:jobId/ready')
  async onReadyForCollection(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.notificationsService.onReadyForCollection(tenantId, jobId);
  }

  @Post('test')
  async sendTestMessage(
    @Body(new ZodValidationPipe(sendTestSchema)) body: SendTestInput,
  ) {
    return this.notificationsService.sendCustomMessage(
      body.phone,
      'MECANIX: Mensagem de teste. A integração WhatsApp está a funcionar correctamente!',
    );
  }

  @Get('templates')
  async getTemplates() {
    return this.notificationsService.getTemplates();
  }

  @Post('appointment/:appointmentId/confirmed')
  async onAppointmentConfirmed(
    @TenantId() tenantId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.notificationsService.onAppointmentConfirmed(tenantId, appointmentId);
  }

  @Post('reminder/:reminderId/due')
  async onServiceReminderDue(
    @TenantId() tenantId: string,
    @Param('reminderId') reminderId: string,
  ) {
    return this.notificationsService.onServiceReminderDue(tenantId, reminderId);
  }

  /** Process appointment reminders (24h + 1h before) — called by cron */
  @Post('process/appointment-reminders')
  async processAppointmentReminders(@TenantId() tenantId: string) {
    return this.notificationsService.processAppointmentReminders(tenantId);
  }

  /** Process overdue invoice payment reminders — called by cron */
  @Post('process/payment-reminders')
  async processPaymentReminders(@TenantId() tenantId: string) {
    return this.notificationsService.processPaymentReminders(tenantId);
  }
}
