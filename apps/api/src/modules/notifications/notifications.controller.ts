import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sendMessageSchema, sendTestSchema } from '@mecanix/validators';
import type { SendMessageInput, SendTestInput } from '@mecanix/validators';
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
    @Body() body: { pushToken: string; platform: string; appType: string },
  ) {
    return this.pushService.registerToken(
      tenantId,
      user.id,
      body.pushToken,
      body.platform as 'ios' | 'android' | 'web',
      body.appType as 'customer' | 'workshop' | 'technician',
    );
  }

  @Delete('push/token')
  async deactivatePushToken(
    @CurrentUser() user: RequestUser,
    @Body() body: { pushToken: string },
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
}
