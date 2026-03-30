import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StockTransferService } from './stock-transfer.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('stock-transfers')
@UseGuards(TenantGuard)
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.stockTransferService.listTransfers(tenantId, status);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stockTransferService.getTransfer(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      fromWarehouseId: string;
      toWarehouseId: string;
      notes?: string;
      lines: Array<{
        partId: string;
        quantity: number;
      }>;
    },
  ) {
    return this.stockTransferService.createTransfer(tenantId, user.id, body);
  }

  @Post(':id/complete')
  async complete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.stockTransferService.completeTransfer(tenantId, id, user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stockTransferService.cancelTransfer(tenantId, id);
  }
}
