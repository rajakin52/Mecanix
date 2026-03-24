import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { earnPointsSchema, redeemPointsSchema } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('loyalty')
@UseGuards(TenantGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get(':customerId')
  async getPoints(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.loyaltyService.getCustomerPoints(tenantId, customerId);
  }

  @Post(':customerId/earn')
  async earnPoints(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(earnPointsSchema)) body: { invoiceId: string; amount: number },
  ) {
    return this.loyaltyService.earnPoints(tenantId, user.id, customerId, body.invoiceId, body.amount);
  }

  @Post(':customerId/redeem')
  async redeemPoints(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(redeemPointsSchema)) body: { points: number; description: string },
  ) {
    return this.loyaltyService.redeemPoints(tenantId, user.id, customerId, body.points, body.description);
  }

  @Get(':customerId/transactions')
  async getTransactions(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.loyaltyService.getTransactions(tenantId, customerId);
  }
}
