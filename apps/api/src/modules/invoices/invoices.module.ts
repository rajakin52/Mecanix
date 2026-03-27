import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { AgtModule } from '../agt/agt.module';

@Module({
  imports: [AgtModule],
  controllers: [InvoicesController, PaymentsController, CreditNotesController],
  providers: [InvoicesService, PaymentsService, CreditNotesService],
  exports: [InvoicesService, PaymentsService, CreditNotesService],
})
export class InvoicesModule {}
