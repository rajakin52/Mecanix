import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PricingModule } from '../pricing/pricing.module';
import { JobsModule } from '../jobs/jobs.module';
import { InspectionsModule } from '../inspections/inspections.module';

@Module({
  imports: [PricingModule, JobsModule, InspectionsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
