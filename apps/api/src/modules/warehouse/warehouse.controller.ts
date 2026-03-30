import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('warehouses')
@UseGuards(TenantGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.warehouseService.listWarehouses(tenantId);
  }

  @Get('summary')
  async summary(@TenantId() tenantId: string) {
    return this.warehouseService.getInventorySummary(tenantId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.warehouseService.getWarehouse(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      name: string;
      code: string;
      type?: string;
      branchId?: string;
      address?: string;
      isDefault?: boolean;
      notes?: string;
    },
  ) {
    return this.warehouseService.createWarehouse(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      code?: string;
      type?: string;
      branchId?: string;
      address?: string;
      isDefault?: boolean;
      notes?: string;
    },
  ) {
    return this.warehouseService.updateWarehouse(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.warehouseService.deleteWarehouse(tenantId, id);
  }

  @Get(':id/stock')
  async getStock(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.warehouseService.getStockByWarehouse(tenantId, id);
  }

  @Get('part/:partId/stock')
  async getStockByPart(
    @TenantId() tenantId: string,
    @Param('partId') partId: string,
  ) {
    return this.warehouseService.getStockByPart(tenantId, partId);
  }

  @Post('move-stock')
  async moveStock(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      partId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      quantity: number;
      reason?: string;
    },
  ) {
    return this.warehouseService.moveStock(tenantId, user.id, body);
  }
}
