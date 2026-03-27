import { Module } from '@nestjs/common';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { CannedNotesController } from './canned-notes.controller';
import { CannedNotesService } from './canned-notes.service';

@Module({
  controllers: [InspectionsController, CannedNotesController],
  providers: [InspectionsService, CannedNotesService],
  exports: [InspectionsService, CannedNotesService],
})
export class InspectionsModule {}
