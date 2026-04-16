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
import { JobsService } from './jobs.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createJobCardSchema,
  updateJobCardSchema,
  changeStatusSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  CreateJobCardInput,
  UpdateJobCardInput,
  ChangeStatusInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('jobs')
@UseGuards(TenantGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.jobsService.list(tenantId, query, {
      status,
      customerId,
      vehicleId,
      technicianId,
    });
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.jobsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createJobCardSchema)) body: CreateJobCardInput,
  ) {
    return this.jobsService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateJobCardSchema)) body: UpdateJobCardInput,
  ) {
    return this.jobsService.update(tenantId, id, user.id, body);
  }

  @Post(':id/status')
  async changeStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeStatusSchema)) body: ChangeStatusInput,
  ) {
    return this.jobsService.updateStatus(
      tenantId,
      id,
      user.id,
      body.status,
      body.notes,
    );
  }

  @Get(':id/history')
  async getStatusHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.jobsService.getStatusHistory(tenantId, id);
  }

  @Post(':id/split')
  async splitJob(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { label: string; technicianId?: string },
  ) {
    // Get parent job details
    const parent = await this.jobsService.getById(tenantId, id);
    // Create sub-job inheriting vehicle + customer from parent
    return this.jobsService.create(tenantId, user.id, {
      vehicleId: parent.vehicle_id as string,
      customerId: parent.customer_id as string,
      reportedProblem: `[${body.label}] ${parent.reported_problem as string}`,
      symptomCodes: [],
      parentJobId: id,
      subJobLabel: body.label,
      primaryTechnicianId: body.technicianId,
      isInsurance: parent.is_insurance as boolean,
      isTaxable: parent.is_taxable as boolean,
      requiresAuthorization: false,
      labels: [],
      partsIssuingMode: 'auto' as const,
      isComeback: false,
      isWarranty: false,
      priorityLevel: 'normal' as const,
    } as unknown as CreateJobCardInput);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.jobsService.softDelete(tenantId, id, user.id);
  }

  /** Public job status page (no auth, token-based) */
  @Get('public/status/:token')
  async publicStatus(@Param('token') token: string) {
    return this.jobsService.getByPublicToken(token);
  }

  /** Generate public status token for a job */
  @Post(':id/share')
  async generateShareLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.jobsService.generatePublicToken(tenantId, id);
  }

  /**
   * Get the last completed job for a vehicle — for "Repeat Last Service".
   */
  @Get('vehicle/:vehicleId/last-service')
  async getLastService(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.jobsService.getLastService(tenantId, vehicleId);
  }
}
