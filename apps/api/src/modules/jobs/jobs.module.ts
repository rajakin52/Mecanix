import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { LabourLinesController } from './labour-lines.controller';
import { LabourLinesService } from './labour-lines.service';
import { PartsLinesController } from './parts-lines.controller';
import { PartsLinesService } from './parts-lines.service';
import { QcChecksController } from './qc-checks.controller';
import { QcChecksService } from './qc-checks.service';
import { BodyStagesController } from './body-stages.controller';
import { BodyStagesService } from './body-stages.service';
import { LinePhotosController } from './line-photos.controller';
import { LinePhotosService } from './line-photos.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { PricingModule } from '../pricing/pricing.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { SymptomsModule } from '../symptoms/symptoms.module';
import { PartsModule } from '../parts/parts.module';

@Module({
  imports: [PricingModule, InspectionsModule, SymptomsModule, PartsModule],
  controllers: [JobsController, LabourLinesController, PartsLinesController, QcChecksController, BodyStagesController, LinePhotosController, MaterialsController],
  providers: [JobsService, LabourLinesService, PartsLinesService, QcChecksService, BodyStagesService, LinePhotosService, MaterialsService],
  exports: [JobsService, PartsLinesService, QcChecksService, LinePhotosService, MaterialsService],
})
export class JobsModule {}
