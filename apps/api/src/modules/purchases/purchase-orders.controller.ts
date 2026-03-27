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
import { PurchaseOrdersService } from './purchase-orders.service';
import { CostingService } from '../parts/costing.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPurchaseOrderSchema,
  createPoLineSchema,
  receiveGoodsSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  CreatePurchaseOrderInput,
  CreatePoLineInput,
  ReceiveGoodsInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { z } from 'zod';

const changePoStatusSchema = z.object({
  status: z.string().min(1),
});

@Controller('purchase-orders')
@UseGuards(TenantGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly costingService: CostingService,
  ) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.purchaseOrdersService.list(tenantId, query, vendorId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPurchaseOrderSchema)) body: CreatePurchaseOrderInput,
  ) {
    return this.purchaseOrdersService.create(tenantId, user.id, body);
  }

  @Post(':id/lines')
  async addLine(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPoLineSchema)) body: CreatePoLineInput,
  ) {
    return this.purchaseOrdersService.addLine(tenantId, id, user.id, body);
  }

  @Delete(':id/lines/:lineId')
  async removeLine(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.purchaseOrdersService.removeLine(tenantId, lineId, id);
  }

  @Post(':id/receive')
  async receiveGoods(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(receiveGoodsSchema)) body: ReceiveGoodsInput,
  ) {
    return this.purchaseOrdersService.receiveGoods(tenantId, id, user.id, body);
  }

  @Patch(':id/status')
  async updateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changePoStatusSchema)) body: { status: string },
  ) {
    return this.purchaseOrdersService.updateStatus(tenantId, id, user.id, body.status);
  }

  @Post(':id/landed-costs')
  async applyLandedCosts(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { additionalCosts: Array<{ type: string; amount: number }> },
  ) {
    return this.costingService.applyLandedCosts(tenantId, id, body.additionalCosts);
  }
}
