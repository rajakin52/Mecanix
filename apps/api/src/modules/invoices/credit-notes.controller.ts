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
import { createCreditNoteSchema } from '@mecanix/validators';
import type { CreateCreditNoteInput } from '@mecanix/validators';
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
