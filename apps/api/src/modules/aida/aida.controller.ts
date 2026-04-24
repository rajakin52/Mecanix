import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AidaService } from './aida.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  uploadPhotoSchema,
  createFindingSchema,
  updateFindingSchema,
  createOperationSchema,
  updateOperationSchema,
  finaliseAssessmentSchema,
  createClaimFromAssessmentSchema,
} from '@mecanix/validators';
import type {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  UploadAssessmentPhotoInput,
  CreateAssessmentFindingInput,
  UpdateAssessmentFindingInput,
  CreateAssessmentOperationInput,
  UpdateAssessmentOperationInput,
  FinaliseAssessmentInput,
  CreateClaimFromAssessmentInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('aida')
@UseGuards(TenantGuard)
export class AidaStatsController {
  constructor(private readonly service: AidaService) {}

  @Get('stats')
  async stats(@TenantId() tenantId: string) {
    return this.service.getMonthlyStats(tenantId);
  }

  @Get('effective-rates')
  async effectiveRates(@TenantId() tenantId: string) {
    return this.service.getEffectiveRates(tenantId);
  }
}

@Controller('aida/assessments')
@UseGuards(TenantGuard)
export class AidaController {
  constructor(private readonly service: AidaService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('jobCardId') jobCardId?: string,
    @Query('claimId') claimId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list(tenantId, { vehicleId, jobCardId, claimId, status });
  }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createAssessmentSchema)) body: CreateAssessmentInput,
  ) {
    return this.service.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAssessmentSchema)) body: UpdateAssessmentInput,
  ) {
    return this.service.update(tenantId, id, body);
  }

  @Post(':id/finalise')
  async finalise(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finaliseAssessmentSchema)) body: FinaliseAssessmentInput,
  ) {
    return this.service.finalise(tenantId, id, user.id, body);
  }

  @Post(':id/analyse')
  async analyse(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.service.analyse(tenantId, id, user.id, { force: force === 'true' });
  }

  @Post(':id/create-job')
  async createJob(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.createJobFromAssessment(tenantId, id, user.id);
  }

  @Post(':id/create-claim')
  async createClaim(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createClaimFromAssessmentSchema))
    body: CreateClaimFromAssessmentInput,
  ) {
    return this.service.createClaimFromAssessment(tenantId, id, user.id, body);
  }

  @Post(':id/packet')
  async packet(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.generatePacket(tenantId, id, user.id);
  }

  @Get(':id/edits')
  async edits(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.listEdits(tenantId, id);
  }

  @Post(':id/capture-link')
  async captureLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.ensureCaptureToken(tenantId, id);
  }

  @Post(':id/send-capture-link')
  async sendCaptureLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { phone: string; languageCode?: 'pt_PT' | 'en' },
  ) {
    if (!body?.phone || typeof body.phone !== 'string') {
      throw new Error('phone is required');
    }
    return this.service.sendCaptureLinkViaWhatsApp(tenantId, id, body.phone, body.languageCode);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }

  // ─── photos ──────────────────────────────────────────────────
  @Post(':id/photos')
  async uploadPhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(uploadPhotoSchema)) body: UploadAssessmentPhotoInput,
  ) {
    return this.service.uploadPhoto(tenantId, id, user.id, body);
  }

  @Delete(':id/photos/:photoId')
  async deletePhoto(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.service.deletePhoto(tenantId, id, photoId);
  }

  // ─── findings ────────────────────────────────────────────────
  @Post(':id/findings')
  async addFinding(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createFindingSchema)) body: CreateAssessmentFindingInput,
  ) {
    return this.service.addFinding(tenantId, id, user.id, body);
  }

  @Patch(':id/findings/:findingId')
  async updateFinding(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
    @Body(new ZodValidationPipe(updateFindingSchema)) body: UpdateAssessmentFindingInput,
  ) {
    return this.service.updateFinding(tenantId, id, findingId, user.id, body);
  }

  @Delete(':id/findings/:findingId')
  async deleteFinding(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
  ) {
    return this.service.deleteFinding(tenantId, id, findingId, user.id);
  }

  // ─── operations ──────────────────────────────────────────────
  @Post(':id/operations')
  async addOperation(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createOperationSchema)) body: CreateAssessmentOperationInput,
  ) {
    return this.service.addOperation(tenantId, id, user.id, body);
  }

  @Patch(':id/operations/:opId')
  async updateOperation(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('opId') opId: string,
    @Body(new ZodValidationPipe(updateOperationSchema)) body: UpdateAssessmentOperationInput,
  ) {
    return this.service.updateOperation(tenantId, id, opId, user.id, body);
  }

  @Delete(':id/operations/:opId')
  async deleteOperation(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('opId') opId: string,
  ) {
    return this.service.deleteOperation(tenantId, id, opId, user.id);
  }
}

// Public capture flow — token-authorised, no tenant guard.
@Controller('public/aida/capture')
export class PublicAidaCaptureController {
  constructor(private readonly service: AidaService) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    return this.service.getByCaptureToken(token);
  }

  @Post(':token/photos')
  async uploadPhoto(
    @Param('token') token: string,
    @Body() body: { file: string; filename: string; viewAngle?: string },
  ) {
    return this.service.uploadPhotoByToken(token, body);
  }
}
