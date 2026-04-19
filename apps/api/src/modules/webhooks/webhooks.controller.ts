import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from '@mecanix/validators';

@Controller('webhooks')
@UseGuards(TenantGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.webhooksService.list(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooksService.create(tenantId, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) body: UpdateWebhookInput,
  ) {
    return this.webhooksService.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooksService.delete(tenantId, id);
  }

  @Get(':id/logs')
  async getLogs(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooksService.getLogs(tenantId, id);
  }
}
