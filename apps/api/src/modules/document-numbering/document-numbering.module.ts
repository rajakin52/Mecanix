import { Module } from '@nestjs/common';
import { DocumentNumberingController } from './document-numbering.controller';
import { DocumentNumberingService } from './document-numbering.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [SupabaseModule, PermissionsModule],
  controllers: [DocumentNumberingController],
  providers: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
