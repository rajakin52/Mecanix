import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sendMessageSchema, sendTestSchema } from '@mecanix/validators';
import type { SendMessageInput, SendTestInput } from '@mecanix/validators';

@Controller('notifications')
@UseGuards(TenantGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

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
}
