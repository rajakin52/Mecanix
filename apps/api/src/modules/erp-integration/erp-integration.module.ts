import { Module } from '@nestjs/common';
import { ErpIntegrationController } from './erp-integration.controller';
import { ErpIntegrationService } from './erp-integration.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ErpIntegrationController],
  providers: [ErpIntegrationService],
  exports: [ErpIntegrationService],
})
export class ErpIntegrationModule {}
