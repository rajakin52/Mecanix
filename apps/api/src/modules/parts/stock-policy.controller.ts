import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { StockPolicyService } from './stock-policy.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { updateStockPolicySchema, type UpdateStockPolicyInput } from '@mecanix/validators';

@Controller('parts/stock-policy')
@UseGuards(TenantGuard)
export class StockPolicyController {
  constructor(private readonly stockPolicyService: StockPolicyService) {}

  @Get()
  async get(@TenantId() tenantId: string) {
    return this.stockPolicyService.getPolicy(tenantId);
  }

  @Put()
  @UseGuards(RolesGuard, CapabilityGuard)
  @Roles('owner')
  @RequiresCapability('settings.tenant')
  async update(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateStockPolicySchema)) body: UpdateStockPolicyInput,
  ) {
    return this.stockPolicyService.updatePolicy(tenantId, body);
  }
}
