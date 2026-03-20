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
  ) {
    return this.partsService.list(tenantId, query, {
      category,
      lowStock: lowStock === 'true',
    });
  }

  @Get('low-stock')
  async getLowStock(@TenantId() tenantId: string) {
    return this.partsService.getLowStock(tenantId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.partsService.getById(tenantId, id);
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
