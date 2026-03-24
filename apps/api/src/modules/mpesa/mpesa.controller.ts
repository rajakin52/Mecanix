import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('mpesa')
@UseGuards(TenantGuard)
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @Post('pay')
  async initiatePayment(
    @Body() body: { phoneNumber: string; amount: number; invoiceId: string },
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
