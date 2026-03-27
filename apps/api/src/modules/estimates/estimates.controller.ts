import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller()
@UseGuards(TenantGuard)
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('jobs/:jobId/estimates')
  async listByJob(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.estimatesService.listByJob(tenantId, jobId);
  }

  @Get('estimates/:id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.estimatesService.getById(tenantId, id);
  }

  @Post('jobs/:jobId/estimates')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body() body: { terms?: string; validUntil?: string },
  ) {
    return this.estimatesService.create(tenantId, user.id, jobId, body);
  }

  @Post('estimates/:id/send')
  async send(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { channels: string[] },
  ) {
    const channels = body.channels ?? ['print'];
    // Send via notification service (WhatsApp, push, etc.)
    return this.notificationsService.sendEstimate(tenantId, id, channels);
  }

  @Post('estimates/:id/approve')
  async approve(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { notes?: string; signatureUrl?: string; method?: string },
  ) {
    return this.estimatesService.approve(tenantId, id, body);
  }

  @Post('estimates/:id/reject')
  async reject(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.estimatesService.reject(tenantId, id, body);
  }
}
