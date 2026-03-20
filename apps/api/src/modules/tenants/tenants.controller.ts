import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tenants')
@UseGuards(TenantGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getCurrentTenant(@TenantId() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  @Patch('me')
  @Roles('owner')
  async updateTenant(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.tenantsService.updateTenant(tenantId, body);
  }
}
