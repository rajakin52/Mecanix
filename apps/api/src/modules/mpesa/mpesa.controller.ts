import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { mpesaPaySchema } from '@mecanix/validators';
import type { MpesaPayInput } from '@mecanix/validators';

@Controller('mpesa')
@UseGuards(TenantGuard)
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @Post('pay')
  async initiatePayment(
    @Body(new ZodValidationPipe(mpesaPaySchema)) body: MpesaPayInput,
  ) {
    return this.mpesaService.initiatePayment({
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      reference: body.invoiceId,
      thirdPartyReference: `INV-${body.invoiceId.slice(0, 8)}`,
    });
  }

  @Get('status/:transactionId')
  async checkStatus(@Param('transactionId') transactionId: string) {
    return this.mpesaService.checkStatus(transactionId);
  }

  @Get('configured')
  async isConfigured() {
    return { configured: this.mpesaService.isConfigured() };
  }
}
