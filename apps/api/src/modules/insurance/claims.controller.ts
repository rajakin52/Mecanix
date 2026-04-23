import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  initiateClaimSchema,
  changeClaimStatusSchema,
  updateClaimSchema,
  addClaimPhotoSchema,
  paginationSchema,
  checkTotalLossSchema,
} from '@mecanix/validators';
import type {
  InitiateClaimInput,
  ChangeClaimStatusInput,
  UpdateClaimInput,
  AddClaimPhotoInput,
  PaginationInput,
  CheckTotalLossInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('insurance/claims')
@UseGuards(TenantGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('status') status?: string,
    @Query('insuranceCompanyId') insuranceCompanyId?: string,
  ) {
    return this.claimsService.list(tenantId, query, {
      status,
      insuranceCompanyId,
    });
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.claimsService.getById(tenantId, id);
  }

  @Post()
  async initiate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(initiateClaimSchema)) body: InitiateClaimInput,
  ) {
    return this.claimsService.initiate(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClaimSchema)) body: UpdateClaimInput,
  ) {
    return this.claimsService.update(tenantId, id, body);
  }

  @Post(':id/status')
  async changeStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeClaimStatusSchema)) body: ChangeClaimStatusInput,
  ) {
    return this.claimsService.updateStatus(
      tenantId,
      id,
      body.status,
      body.notes,
      body.assessorName,
    );
  }

  @Post(':id/photos')
  async addPhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addClaimPhotoSchema)) body: AddClaimPhotoInput,
  ) {
    return this.claimsService.addPhoto(tenantId, id, user.id, body);
  }

  @Post(':id/total-loss')
  async checkTotalLoss(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkTotalLossSchema)) body: CheckTotalLossInput,
  ) {
    return this.claimsService.checkTotalLoss(tenantId, id, body.vehicleValue);
  }

  @Get(':id/photos')
  async getPhotos(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.claimsService.getPhotos(tenantId, id);
  }

  @Get(':id/actions')
  async getAssessorActions(
    @Param('id') id: string,
  ) {
    return this.claimsService.getAssessorActions(id);
  }
}
