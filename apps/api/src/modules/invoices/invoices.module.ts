import { Module } from '@nestjs/common';
import { InvoicesController, PublicInvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CreditNotesController, CreditNotesRegisterController, InvoiceCreditAndRebillController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { AgtModule } from '../agt/agt.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { PartsModule } from '../parts/parts.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [AgtModule, NotificationsModule, PricingModule, PartsModule, WarehouseModule],
  controllers: [InvoicesController, PublicInvoicesController, PaymentsController, CreditNotesController, CreditNotesRegisterController, InvoiceCreditAndRebillController],
  providers: [InvoicesService, PaymentsService, CreditNotesService],
  exports: [InvoicesService, PaymentsService, CreditNotesService],
})
export class InvoicesModule {}
