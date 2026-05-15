import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createCreditNoteSchema, creditAndRebillSchema } from '@mecanix/validators';
import type { CreateCreditNoteInput, CreditAndRebillInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('invoices/:invoiceId/credit-notes')
@UseGuards(TenantGuard)
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.creditNotesService.listByInvoice(tenantId, invoiceId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(createCreditNoteSchema)) body: CreateCreditNoteInput,
  ) {
    return this.creditNotesService.create(tenantId, user.id, invoiceId, body);
  }
}

// Full-flow helper: credit the invoice, clone the billed lines back
// to the JC, reopen the JC. Sits one level up from /credit-notes
// because the noun-of-action is the invoice, not the credit note —
// and chaining /credit-notes/credit-and-rebill would imply you're
// creating something under an existing NC.
@Controller('invoices/:invoiceId')
@UseGuards(TenantGuard)
export class InvoiceCreditAndRebillController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post('credit-and-rebill')
  async creditAndRebill(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(creditAndRebillSchema)) body: CreditAndRebillInput,
  ) {
    return this.creditNotesService.creditAndRebill(
      tenantId,
      user.id,
      invoiceId,
      body.reason,
    );
  }
}

@Controller('credit-notes')
@UseGuards(TenantGuard)
export class CreditNotesRegisterController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.creditNotesService.listAll(tenantId);
  }
}
