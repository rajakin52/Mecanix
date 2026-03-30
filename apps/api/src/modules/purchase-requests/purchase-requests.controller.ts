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
import { PurchaseRequestsService } from './purchase-requests.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('purchase-requests')
@UseGuards(TenantGuard)
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.purchaseRequestsService.list(tenantId, status);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseRequestsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      jobCardId: string;
      partsRequestId?: string;
      items: Array<{
        partId: string;
        quantity: number;
        estimatedUnitCost?: number;
      }>;
      notes?: string;
    },
  ) {
    return this.purchaseRequestsService.create(tenantId, user.id, body);
  }

  @Post(':id/approve')
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { via?: string },
  ) {
    return this.purchaseRequestsService.approve(tenantId, id, user.id, body.via);
  }

  @Post(':id/reject')
  async reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.purchaseRequestsService.reject(tenantId, id, user.id, body.reason);
  }

  @Patch(':id/link-po')
  async linkPurchaseOrder(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { purchaseOrderId: string; vendorId: string },
  ) {
    return this.purchaseRequestsService.linkPurchaseOrder(
      tenantId,
      id,
      body.purchaseOrderId,
      body.vendorId,
    );
  }

  @Post(':id/receive')
  async markReceived(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.purchaseRequestsService.markReceived(tenantId, id, user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseRequestsService.cancel(tenantId, id);
  }
}
