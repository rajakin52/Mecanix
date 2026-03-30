import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StockCountService } from './stock-count.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('stock-counts')
@UseGuards(TenantGuard)
export class StockCountController {
  constructor(private readonly stockCountService: StockCountService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.stockCountService.listCounts(tenantId);
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
    @Body() body: {
      warehouseId: string;
      categoryFilter?: string;
      notes?: string;
    },
  ) {
    return this.stockCountService.createCount(tenantId, user.id, body);
  }

  @Patch(':countId/lines/:lineId')
  async updateLine(
    @TenantId() tenantId: string,
    @Param('countId') countId: string,
    @Param('lineId') lineId: string,
    @Body() body: {
      countedQty: number;
      notes?: string;
    },
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
}
