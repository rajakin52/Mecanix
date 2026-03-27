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
