import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  reviewEstimateLineSchema,
  approveEstimateSchema,
} from '@mecanix/validators';
import type {
  ReviewEstimateLineInput,
  ApproveEstimateInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('insurance')
@UseGuards(TenantGuard)
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Post('claims/:claimId/estimates')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('claimId') claimId: string,
  ) {
    return this.estimatesService.create(tenantId, claimId, user.id);
  }

  @Get('estimates/:id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.estimatesService.getById(tenantId, id);
  }

  @Post('estimates/:id/lines/:lineId/review')
  async reviewLine(
    @TenantId() tenantId: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(reviewEstimateLineSchema)) body: ReviewEstimateLineInput,
  ) {
    return this.estimatesService.reviewLine(
      tenantId,
      lineId,
      body.assessorStatus,
      body.assessorPrice,
      body.assessorComment,
    );
  }

  @Post('estimates/:id/approve')
  async approveEstimate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveEstimateSchema)) body: ApproveEstimateInput,
  ) {
    return this.estimatesService.approveEstimate(
      tenantId,
      id,
      body.assessorName,
      body.notes,
    );
  }

  @Post('estimates/:id/reject')
  async rejectEstimate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveEstimateSchema)) body: ApproveEstimateInput,
  ) {
    return this.estimatesService.rejectEstimate(
      tenantId,
      id,
      body.assessorName,
      body.notes,
    );
  }
}
