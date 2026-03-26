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
import { PricingService } from './pricing.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPriceGroupSchema,
  updatePriceGroupSchema,
  createPriceGroupRuleSchema,
  updatePricingSettingsSchema,
} from '@mecanix/validators';
import type {
  CreatePriceGroupInput,
  UpdatePriceGroupInput,
  CreatePriceGroupRuleInput,
  UpdatePricingSettingsInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('pricing')
@UseGuards(TenantGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ── Price Groups ──────────────────────────────────────────

  @Get('groups')
  async listGroups(@TenantId() tenantId: string) {
    return this.pricingService.listGroups(tenantId);
  }

  @Get('groups/:id')
  async getGroup(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.pricingService.getGroup(tenantId, id);
  }

  @Post('groups')
  async createGroup(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPriceGroupSchema)) body: CreatePriceGroupInput,
  ) {
    return this.pricingService.createGroup(tenantId, user.id, body);
  }

  @Patch('groups/:id')
  async updateGroup(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePriceGroupSchema)) body: UpdatePriceGroupInput,
  ) {
    return this.pricingService.updateGroup(tenantId, id, body);
  }

  @Delete('groups/:id')
  async deleteGroup(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.pricingService.deleteGroup(tenantId, id);
  }

  // ── Price Group Rules ─────────────────────────────────────

  @Post('groups/:groupId/rules')
  async addRule(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(createPriceGroupRuleSchema)) body: CreatePriceGroupRuleInput,
  ) {
    return this.pricingService.addRule(tenantId, groupId, body);
  }

  @Delete('rules/:ruleId')
  async deleteRule(@TenantId() tenantId: string, @Param('ruleId') ruleId: string) {
    return this.pricingService.deleteRule(tenantId, ruleId);
  }

  // ── Resolve Markup ────────────────────────────────────────

  @Get('resolve')
  async resolveMarkup(
    @TenantId() tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('partCategory') partCategory?: string,
  ) {
    return this.pricingService.resolveMarkup(tenantId, customerId ?? null, partCategory ?? null);
  }

  // ── Pricing Settings ──────────────────────────────────────

  @Get('settings')
  async getSettings(@TenantId() tenantId: string) {
    return this.pricingService.getPricingSettings(tenantId);
  }

  @Patch('settings')
  async updateSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updatePricingSettingsSchema)) body: UpdatePricingSettingsInput,
  ) {
    return this.pricingService.updatePricingSettings(tenantId, body);
  }
}
