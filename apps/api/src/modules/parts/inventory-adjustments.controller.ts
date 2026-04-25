import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createInventoryAdjustmentSchema,
  type CreateInventoryAdjustmentInput,
} from '@mecanix/validators';

/**
 * Dedicated stock-adjustment transaction. Listing is open to anyone
 * who can see warehouses; creating an adjustment is owner/manager
 * only because it directly mutates inventory and bypasses the
 * supplier-invoice path.
 */
@Controller('inventory-adjustments')
@UseGuards(TenantGuard, RolesGuard)
export class InventoryAdjustmentsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('partId') partId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.list(
      tenantId,
      { warehouseId, partId, fromDate, toDate },
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Post()
  @Roles('owner', 'manager')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createInventoryAdjustmentSchema))
    body: CreateInventoryAdjustmentInput,
  ) {
    return this.inventoryService.create(tenantId, user.id, body);
  }
}
