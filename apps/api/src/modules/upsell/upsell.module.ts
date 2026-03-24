import { Module } from '@nestjs/common';
import { UpsellController } from './upsell.controller';
import { UpsellService } from './upsell.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [UpsellController],
  providers: [UpsellService],
  exports: [UpsellService],
})
export class UpsellModule {}
