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
import { StockCountService } from './stock-count.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createStockCountSchema,
  updateStockCountLineSchema,
  type CreateStockCountInput,
  type UpdateStockCountLineInput,
} from '@mecanix/validators';

@Controller('stock-counts')
@UseGuards(TenantGuard)
export class StockCountController {
  constructor(private readonly stockCountService: StockCountService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.stockCountService.listCounts(
      tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stockCountService.getCount(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createStockCountSchema)) body: CreateStockCountInput,
  ) {
    return this.stockCountService.createCount(tenantId, user.id, body);
  }

  @Post(':countId/lines')
  async addLine(
    @TenantId() tenantId: string,
    @Param('countId') countId: string,
    @Body() body: { partId: string },
  ) {
    return this.stockCountService.addLine(tenantId, countId, body.partId);
  }

  @Patch(':countId/lines/:lineId')
  async updateLine(
    @TenantId() tenantId: string,
    @Param('countId') countId: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(updateStockCountLineSchema)) body: UpdateStockCountLineInput,
  ) {
    return this.stockCountService.updateCountLine(tenantId, countId, lineId, body);
  }

  @Post(':id/approve')
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.stockCountService.approveCount(tenantId, id, user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stockCountService.cancelCount(tenantId, id);
  }

  // ─── Export / Import ──────────────────────────────────────────
  @Get(':id/export')
  async exportXlsx(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('sortBy') sortBy?: 'part_number' | 'description' | 'location',
  ) {
    return this.stockCountService.exportToXlsx(tenantId, id, sortBy ?? 'part_number');
  }

  @Post(':id/import')
  async importXlsx(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { fileName?: string; base64: string },
  ) {
    if (!body?.base64 || typeof body.base64 !== 'string') {
      throw new Error('base64 file payload is required');
    }
    const buffer = Buffer.from(body.base64, 'base64');
    return this.stockCountService.importFromXlsx(tenantId, id, buffer);
  }
}
