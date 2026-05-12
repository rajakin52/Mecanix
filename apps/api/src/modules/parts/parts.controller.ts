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
import { PartsService } from './parts.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPartSchema,
  updatePartSchema,
  adjustStockSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  CreatePartInput,
  UpdatePartInput,
  AdjustStockInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('parts')
@UseGuards(TenantGuard)
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string,
    @Query('consumable') consumable?: string,
    @Query('make') make?: string,
    @Query('model') model?: string,
    @Query('year') year?: string,
  ) {
    const vehicle =
      make && make.trim().length > 0
        ? {
            make: make.trim(),
            model: model && model.trim().length > 0 ? model.trim() : undefined,
            year: year && year.trim().length > 0 ? Number(year) : undefined,
          }
        : undefined;

    return this.partsService.list(tenantId, query, {
      category,
      lowStock: lowStock === 'true',
      consumable: consumable === 'true',
      vehicle,
    });
  }

  @Get('scan/:code')
  async scanBarcode(
    @TenantId() tenantId: string,
    @Param('code') code: string,
  ) {
    const part = await this.partsService.findByBarcode(tenantId, code);
    if (!part) return { found: false, part: null };
    return { found: true, part };
  }

  @Get('low-stock')
  async getLowStock(@TenantId() tenantId: string) {
    return this.partsService.getLowStock(tenantId);
  }

  @Get('reorder-suggestions')
  async getReorderSuggestions(@TenantId() tenantId: string) {
    return this.partsService.getReorderSuggestions(tenantId);
  }

  @Get('export')
  async exportCatalogue(@TenantId() tenantId: string) {
    return this.partsService.exportCatalogue(tenantId);
  }

  @Get('vehicle-makes')
  async listVehicleMakes(@TenantId() tenantId: string) {
    return this.partsService.listVehicleMakes(tenantId);
  }

  @Get('vehicle-models')
  async listVehicleModels(
    @TenantId() tenantId: string,
    @Query('make') make: string,
  ) {
    if (!make || !make.trim()) return [];
    return this.partsService.listVehicleModels(tenantId, make.trim());
  }

  @Get('resolve-vehicle')
  async resolveVehicle(
    @TenantId() tenantId: string,
    @Query('plate') plate?: string,
    @Query('jobCardId') jobCardId?: string,
    @Query('jobNumber') jobNumber?: string,
  ) {
    return this.partsService.resolveVehicle(tenantId, { plate, jobCardId, jobNumber });
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.partsService.getById(tenantId, id);
  }

  @Get(':id/purchase-history')
  async getPurchaseHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.partsService.getPurchaseHistory(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPartSchema)) body: CreatePartInput,
  ) {
    return this.partsService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePartSchema)) body: UpdatePartInput,
  ) {
    return this.partsService.update(tenantId, id, user.id, body);
  }

  @Post(':id/adjust')
  async adjustStock(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjustStockSchema)) body: AdjustStockInput,
  ) {
    return this.partsService.adjustStock(tenantId, id, user.id, body);
  }
}
