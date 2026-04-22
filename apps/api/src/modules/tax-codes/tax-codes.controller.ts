import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TaxCodesService, type CreateTaxCodeInput, type UpdateTaxCodeInput } from './tax-codes.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('tax-codes')
@UseGuards(TenantGuard)
export class TaxCodesController {
  constructor(private readonly service: TaxCodesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Get('default')
  getDefault(@TenantId() tenantId: string) {
    return this.service.getDefault(tenantId);
  }

  @Post()
  @UseGuards(RolesGuard, CapabilityGuard)
  @Roles('owner', 'manager')
  @RequiresCapability('tax_codes.manage')
  create(@TenantId() tenantId: string, @Body() body: CreateTaxCodeInput) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, CapabilityGuard)
  @Roles('owner', 'manager')
  @RequiresCapability('tax_codes.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateTaxCodeInput,
  ) {
    return this.service.update(tenantId, id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, CapabilityGuard)
  @Roles('owner', 'manager')
  @RequiresCapability('tax_codes.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
