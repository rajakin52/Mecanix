import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('parts')
@UseGuards(TenantGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':partId/adjustments')
  async getAdjustments(
    @TenantId() tenantId: string,
    @Param('partId') partId: string,
  ) {
    return this.inventoryService.getAdjustments(tenantId, partId);
  }
}
