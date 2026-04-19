import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createStandaloneEstimateSchema,
  updateStandaloneEstimateSchema,
  convertEstimateSchema,
  approveStandaloneEstimateSchema,
  rejectStandaloneEstimateSchema,
  publicEstimateActionSchema,
  type CreateStandaloneEstimateInput,
  type UpdateStandaloneEstimateInput,
  type ConvertEstimateInput,
  type ApproveStandaloneEstimateInput,
  type RejectStandaloneEstimateInput,
  type PublicEstimateActionInput,
} from '@mecanix/validators';

// Public endpoints (no auth — token validated)
@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get(':token')
  async getPublic(@Param('token') token: string) {
    const estimateId = this.estimatesService.validatePublicToken(token);
    if (!estimateId) throw new NotFoundException('Invalid or expired link');
    return this.estimatesService.getPublicEstimate(estimateId);
  }

  @Post(':token/approve')
  async approvePublic(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(publicEstimateActionSchema)) body: PublicEstimateActionInput,
  ) {
    const estimateId = this.estimatesService.validatePublicToken(token);
    if (!estimateId) throw new NotFoundException('Invalid or expired link');
    return this.estimatesService.approvePublic(estimateId, body);
  }

  @Post(':token/reject')
  async rejectPublic(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(publicEstimateActionSchema)) body: PublicEstimateActionInput,
  ) {
    const estimateId = this.estimatesService.validatePublicToken(token);
    if (!estimateId) throw new NotFoundException('Invalid or expired link');
    return this.estimatesService.rejectPublic(estimateId, body);
  }
}

@Controller()
@UseGuards(TenantGuard)
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Standalone estimate endpoints ──

  @Get('estimates')
  async listAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.estimatesService.listAll(
      tenantId,
      { page: Number(page) || 1, pageSize: Number(pageSize) || 20, search },
      { status, source, customerId, vehicleId },
    );
  }

  @Post('estimates/standalone')
  async createStandalone(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createStandaloneEstimateSchema)) body: CreateStandaloneEstimateInput,
  ) {
    return this.estimatesService.createStandalone(tenantId, user.id, body as never);
  }

  @Patch('estimates/:id')
  async updateStandalone(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStandaloneEstimateSchema)) body: UpdateStandaloneEstimateInput,
  ) {
    return this.estimatesService.updateStandalone(tenantId, id, body as never);
  }

  @Post('estimates/:id/convert-to-job')
  async convertToJobCard(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(convertEstimateSchema)) body: ConvertEstimateInput,
  ) {
    return this.estimatesService.convertToJobCard(tenantId, user.id, id, body as never);
  }

  // ── Job-linked estimate endpoints ──

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
    @Body(new ZodValidationPipe(approveStandaloneEstimateSchema)) body: ApproveStandaloneEstimateInput,
  ) {
    return this.estimatesService.approve(tenantId, id, body);
  }

  @Post('jobs/:jobId/auto-convert-dvi')
  async autoConvertDvi(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
    @Body() body: { inspectionId: string },
  ) {
    return this.estimatesService.autoConvertDviToLines(tenantId, jobId, body.inspectionId);
  }

  @Get('estimates/:id/public-link')
  async getPublicLink(@Param('id') id: string) {
    const token = this.estimatesService.generatePublicToken(id);
    return { token, url: `/public/estimate/${token}` };
  }

  @Post('estimates/:id/reject')
  async reject(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectStandaloneEstimateSchema)) body: RejectStandaloneEstimateInput,
  ) {
    return this.estimatesService.reject(tenantId, id, body);
  }
}
