import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  openRegisterSchema,
  closeRegisterSchema,
  createTransactionSchema,
  createBankDepositSchema,
} from '@mecanix/validators';
import type {
  OpenRegisterInput,
  CloseRegisterInput,
  CreateTransactionInput,
  CreateBankDepositInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('cash-register')
@UseGuards(TenantGuard)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Post('open')
  async open(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(openRegisterSchema)) body: OpenRegisterInput,
  ) {
    return this.service.open(tenantId, user.id, body);
  }

  @Post('close')
  async close(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(closeRegisterSchema)) body: CloseRegisterInput,
  ) {
    return this.service.close(tenantId, user.id, body);
  }

  @Get('current')
  async getCurrent(@TenantId() tenantId: string) {
    return this.service.getCurrent(tenantId);
  }

  @Get('report')
  async getDailyReport(
    @TenantId() tenantId: string,
    @Query('registerId') registerId?: string,
  ) {
    return this.service.getDailyReport(tenantId, registerId);
  }

  @Get('transactions')
  async getTransactions(@TenantId() tenantId: string) {
    return this.service.getTransactions(tenantId);
  }

  @Post('transactions')
  async addTransaction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createTransactionSchema)) body: CreateTransactionInput,
  ) {
    return this.service.addTransaction(tenantId, user.id, body);
  }

  @Post('bank-deposits')
  async addBankDeposit(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createBankDepositSchema)) body: CreateBankDepositInput,
  ) {
    return this.service.addBankDeposit(tenantId, user.id, body);
  }
}
