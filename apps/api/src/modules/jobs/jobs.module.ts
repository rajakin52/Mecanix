import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { LabourLinesController } from './labour-lines.controller';
import { LabourLinesService } from './labour-lines.service';
import { PartsLinesController } from './parts-lines.controller';
import { PartsLinesService } from './parts-lines.service';
import { PricingModule } from '../pricing/pricing.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { SymptomsModule } from '../symptoms/symptoms.module';

@Module({
  imports: [PricingModule, InspectionsModule, SymptomsModule],
  controllers: [JobsController, LabourLinesController, PartsLinesController],
  providers: [JobsService, LabourLinesService, PartsLinesService],
  exports: [JobsService, PartsLinesService],
})
export class JobsModule {}
