import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createBillSchema, recordPaymentSchema, paginationSchema } from '@mecanix/validators';
import type { CreateBillInput, PaginationInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('bills')
@UseGuards(TenantGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
  ) {
    return this.billsService.list(tenantId, query, vendorId, status);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.billsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createBillSchema)) body: CreateBillInput,
  ) {
    return this.billsService.create(tenantId, user.id, body);
  }

  @Post(':id/pay')
  async recordPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: { amount: number },
  ) {
    return this.billsService.recordPayment(tenantId, id, user.id, body.amount);
  }
}
