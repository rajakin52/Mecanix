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
import { WarehouseService } from './warehouse.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  moveStockSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
  type MoveStockInput,
} from '@mecanix/validators';

@Controller('warehouses')
@UseGuards(TenantGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.warehouseService.listWarehouses(
      tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
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
    @Body(new ZodValidationPipe(createWarehouseSchema)) body: CreateWarehouseInput,
  ) {
    return this.warehouseService.createWarehouse(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWarehouseSchema)) body: UpdateWarehouseInput,
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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('stockStatus') stockStatus?: 'all' | 'in_stock' | 'low' | 'out',
  ) {
    return this.warehouseService.getStockByWarehouse(
      tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      { search, category, stockStatus },
    );
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
    @Body(new ZodValidationPipe(moveStockSchema)) body: MoveStockInput,
  ) {
    return this.warehouseService.moveStock(tenantId, user.id, body);
  }
}
