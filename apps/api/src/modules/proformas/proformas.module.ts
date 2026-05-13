import { Module } from '@nestjs/common';
import { ProformasController } from './proformas.controller';
import { ProformasService } from './proformas.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [ProformasController],
  providers: [ProformasService],
  exports: [ProformasService],
})
export class ProformasModule {}
