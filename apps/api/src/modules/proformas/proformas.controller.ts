import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProformasService } from './proformas.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createProformaSchema,
  updateProformaSchema,
  cancelProformaSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  CreateProformaInput,
  UpdateProformaInput,
  CancelProformaInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('proformas')
@UseGuards(TenantGuard, RolesGuard, CapabilityGuard)
export class ProformasController {
  constructor(private readonly proformas: ProformasService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.proformas.list(tenantId, query, { status, customerId });
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.proformas.getById(tenantId, id);
  }

  @Post()
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createProformaSchema)) body: CreateProformaInput,
  ) {
    return this.proformas.create(tenantId, user.id, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProformaSchema)) body: UpdateProformaInput,
  ) {
    return this.proformas.update(tenantId, id, user.id, body);
  }

  @Post(':id/send')
  @Roles('owner', 'manager', 'receptionist')
  async send(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.proformas.markSent(tenantId, id);
  }

  @Post(':id/cancel')
  @Roles('owner', 'manager')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelProformaSchema)) body: CancelProformaInput,
  ) {
    return this.proformas.cancel(tenantId, id, body);
  }

  @Post(':id/convert')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async convert(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.proformas.convertToInvoice(tenantId, user.id, id);
  }
}
