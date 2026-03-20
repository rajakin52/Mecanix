import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';

@Module({
  controllers: [InvoicesController, PaymentsController, CreditNotesController],
  providers: [InvoicesService, PaymentsService, CreditNotesService],
  exports: [InvoicesService, PaymentsService, CreditNotesService],
})
export class InvoicesModule {}
