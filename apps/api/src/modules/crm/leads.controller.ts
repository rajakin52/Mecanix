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
import { LeadsService } from './leads.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createLeadSchema,
  updateLeadSchema,
  changeLeadStatusSchema,
  paginationSchema,
} from '@mecanix/validators';
import type { PaginationInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('crm/leads')
@UseGuards(TenantGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.leadsService.list(tenantId, query, { status, assignedTo });
  }

  @Get('follow-ups')
  async getDueFollowUps(@TenantId() tenantId: string) {
    return this.leadsService.getDueFollowUps(tenantId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createLeadSchema)) body: Record<string, unknown>,
  ) {
    return this.leadsService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) body: Record<string, unknown>,
  ) {
    return this.leadsService.update(tenantId, id, body);
  }

  @Post(':id/status')
  async changeStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeLeadStatusSchema)) body: { status: string },
  ) {
    return this.leadsService.updateStatus(tenantId, id, body.status);
  }

  @Post(':id/convert')
  async convertToCustomer(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.leadsService.convertToCustomer(tenantId, id, user.id);
  }
}
