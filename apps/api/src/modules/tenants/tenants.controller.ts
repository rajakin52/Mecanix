import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { ImpersonationBlockGuard } from '../../common/guards/impersonation-block.guard';
import { BlockedWhenImpersonating } from '../../common/decorators/blocked-when-impersonating.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateTenantSchema,
  setExchangeRateSchema,
  setSecondaryCurrencySchema,
  setTenantSettingSchema,
  updateWorkshopUserSchema,
  createCustomRoleSchema,
  updateCustomRoleSchema,
} from '@mecanix/validators';
import type {
  UpdateTenantInput,
  SetExchangeRateInput,
  SetSecondaryCurrencyInput,
  SetTenantSettingInput,
  UpdateWorkshopUserInput,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
} from '@mecanix/validators';

@Controller('tenants')
@UseGuards(TenantGuard, ImpersonationBlockGuard, RolesGuard, CapabilityGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getCurrentTenant(@TenantId() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  /**
   * Super-admin only: list every tenant for the cross-tenant switcher.
   */
  @Get('admin/all')
  async listAllTenants(@CurrentUser() user: RequestUser) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Super-admin only');
    }
    return this.tenantsService.listAllTenants();
  }

  @Get('me/users')
  @Roles('owner', 'manager')
  @RequiresCapability('users.manage')
  async listUsers(@TenantId() tenantId: string) {
    return this.tenantsService.listUsers(tenantId);
  }

  @Patch('me/users/:userId')
  @Roles('owner', 'manager')
  @RequiresCapability('users.manage')
  async updateWorkshopUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateWorkshopUserSchema)) body: UpdateWorkshopUserInput,
  ) {
    return this.tenantsService.updateUser(
      tenantId,
      {
        id: actor.id,
        role: actor.role,
        email: actor.email,
        homeTenantId: actor.homeTenantId,
        isImpersonating: actor.isImpersonating,
      },
      userId,
      body,
    );
  }

  @Patch('me')
  @Roles('owner')
  @RequiresCapability('settings.tenant')
  async updateTenant(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
  ) {
    return this.tenantsService.updateTenant(tenantId, body);
  }

  @Post('me/exchange-rate')
  @Roles('owner')
  @RequiresCapability('settings.tenant')
  async setExchangeRate(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(setExchangeRateSchema)) body: SetExchangeRateInput,
  ) {
    return this.tenantsService.setExchangeRate(tenantId, body.rate);
  }

  @Get('me/exchange-rate')
  async getExchangeRate(@TenantId() tenantId: string) {
    return this.tenantsService.getExchangeRate(tenantId);
  }

  @Patch('me/secondary-currency')
  @Roles('owner')
  @RequiresCapability('settings.tenant')
  async setSecondaryCurrency(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(setSecondaryCurrencySchema)) body: SetSecondaryCurrencyInput,
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

  // ─── Custom roles ──────────────────────────────────────────────

  @Get('me/capabilities')
  @Roles('owner', 'manager')
  @RequiresCapability('users.manage')
  async listCapabilities() {
    return this.tenantsService.listCapabilities();
  }

  @Get('me/roles')
  @Roles('owner', 'manager')
  @RequiresCapability('users.manage')
  async listRoles(@TenantId() tenantId: string) {
    return this.tenantsService.listRoles(tenantId);
  }

  @Post('me/roles')
  @Roles('owner')
  @RequiresCapability('users.manage')
  @BlockedWhenImpersonating(
    'Custom roles are a tenant design decision — ask the workshop owner to create the role.',
  )
  async createCustomRole(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Body(new ZodValidationPipe(createCustomRoleSchema)) body: CreateCustomRoleInput,
  ) {
    return this.tenantsService.createCustomRole(
      tenantId,
      { id: actor.id, email: actor.email, homeTenantId: actor.homeTenantId },
      body,
    );
  }

  @Patch('me/roles/:roleId')
  @Roles('owner')
  @RequiresCapability('users.manage')
  async updateCustomRole(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(updateCustomRoleSchema)) body: UpdateCustomRoleInput,
  ) {
    return this.tenantsService.updateCustomRole(
      tenantId,
      { id: actor.id, email: actor.email, homeTenantId: actor.homeTenantId },
      roleId,
      body,
    );
  }

  @Delete('me/roles/:roleId')
  @Roles('owner')
  @RequiresCapability('users.manage')
  @BlockedWhenImpersonating('Custom role deletion must be performed by the workshop owner.')
  async deleteCustomRole(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Param('roleId') roleId: string,
  ) {
    return this.tenantsService.deleteCustomRole(
      tenantId,
      { id: actor.id, email: actor.email, homeTenantId: actor.homeTenantId },
      roleId,
    );
  }

  @Put('me/settings/:key')
  @Roles('owner')
  @RequiresCapability('settings.tenant')
  async setSetting(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(setTenantSettingSchema)) body: SetTenantSettingInput,
  ) {
    return this.tenantsService.setSetting(tenantId, key, body.value, {
      userId: user.id,
      actorName: user.email,
      actorHomeTenantId: user.homeTenantId,
    });
  }
}
