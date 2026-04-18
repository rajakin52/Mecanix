import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { StockPolicyService } from './stock-policy.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('parts/stock-policy')
@UseGuards(TenantGuard)
export class StockPolicyController {
  constructor(private readonly stockPolicyService: StockPolicyService) {}

  @Get()
  async get(@TenantId() tenantId: string) {
    return this.stockPolicyService.getPolicy(tenantId);
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles('owner')
  async update(
    @TenantId() tenantId: string,
    @Body() body: { allowNegativeStock?: boolean; overrideRoles?: string[] },
  ) {
    return this.stockPolicyService.updatePolicy(tenantId, body);
  }
}
