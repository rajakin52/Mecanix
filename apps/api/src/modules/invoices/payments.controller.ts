import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { recordInvoicePaymentSchema } from '@mecanix/validators';
import type { RecordInvoicePaymentInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('invoices/:invoiceId/payments')
@UseGuards(TenantGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentsService.listByInvoice(tenantId, invoiceId);
  }

  @Post()
  async record(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(recordInvoicePaymentSchema)) body: RecordInvoicePaymentInput,
  ) {
    return this.paymentsService.recordPayment(tenantId, user.id, invoiceId, body);
  }
}
