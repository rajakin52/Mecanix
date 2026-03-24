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
import { AmcService } from './amc.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAmcPackageSchema,
  updateAmcPackageSchema,
  createAmcSubscriptionSchema,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('amc')
@UseGuards(TenantGuard)
export class AmcController {
  constructor(private readonly amcService: AmcService) {}

  @Get('packages')
  async listPackages(@TenantId() tenantId: string) {
    return this.amcService.listPackages(tenantId);
  }

  @Post('packages')
  async createPackage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createAmcPackageSchema)) body: Record<string, unknown>,
  ) {
    return this.amcService.createPackage(tenantId, user.id, body);
  }

  @Patch('packages/:id')
  async updatePackage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAmcPackageSchema)) body: Record<string, unknown>,
  ) {
    return this.amcService.updatePackage(tenantId, id, body);
  }

  @Get('subscriptions')
  async listSubscriptions(
    @TenantId() tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.amcService.listSubscriptions(tenantId, customerId, status);
  }

  @Post('subscriptions')
  async subscribe(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createAmcSubscriptionSchema)) body: Record<string, unknown>,
  ) {
    return this.amcService.subscribe(tenantId, user.id, body);
  }

  @Post('subscriptions/:id/visit')
  async recordVisit(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.amcService.recordVisit(tenantId, id);
  }

  @Get('check/:customerId/:vehicleId')
  async checkActiveAmc(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    const sub = await this.amcService.getActiveSubscription(tenantId, customerId, vehicleId);
    return { active: !!sub, subscription: sub };
  }
}
