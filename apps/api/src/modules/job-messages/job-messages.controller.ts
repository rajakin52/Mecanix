import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JobMessagesService } from './job-messages.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sendJobMessageSchema, type SendJobMessageInput } from '@mecanix/validators';

@Controller('jobs/:jobId/messages')
@UseGuards(TenantGuard)
export class JobMessagesController {
  constructor(private readonly messagesService: JobMessagesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.list(tenantId, jobId);
  }

  @Post()
  async send(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(sendJobMessageSchema)) body: SendJobMessageInput,
  ) {
    return this.messagesService.send(tenantId, user.id, {
      jobCardId: jobId,
      message: body.message,
      senderName: body.senderName,
      senderRole: body.senderRole,
      photoUrl: body.photoUrl,
    });
  }

  @Post('mark-read')
  async markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.markRead(tenantId, jobId, user.id);
  }

  @Get('unread')
  async unreadCount(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
  ) {
    return this.messagesService.unreadCount(tenantId, jobId, user.id);
  }
}
