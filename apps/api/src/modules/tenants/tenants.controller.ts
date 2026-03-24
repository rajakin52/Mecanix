import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { updateTenantSchema } from '@mecanix/validators';
import type { UpdateTenantInput } from '@mecanix/validators';

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
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
  ) {
    return this.tenantsService.updateTenant(tenantId, body);
  }

  @Post('me/exchange-rate')
  @Roles('owner')
  async setExchangeRate(
    @TenantId() tenantId: string,
    @Body() body: { rate: number },
  ) {
    return this.tenantsService.setExchangeRate(tenantId, body.rate);
  }

  @Get('me/exchange-rate')
  async getExchangeRate(@TenantId() tenantId: string) {
    return this.tenantsService.getExchangeRate(tenantId);
  }

  @Patch('me/secondary-currency')
  @Roles('owner')
  async setSecondaryCurrency(
    @TenantId() tenantId: string,
    @Body() body: { currency: string | null },
  ) {
    return this.tenantsService.setSecondaryCurrency(tenantId, body.currency);
  }

  @Get('me/settings/:key')
  async getSetting(
    @TenantId() tenantId: string,
    @Param('key') key: string,
  ) {
    const value = await this.tenantsService.getSetting(tenantId, key);
    return { key, value };
  }

  @Put('me/settings/:key')
  @Roles('owner')
  async setSetting(
    @TenantId() tenantId: string,
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    return this.tenantsService.setSetting(tenantId, key, body.value);
  }
}
