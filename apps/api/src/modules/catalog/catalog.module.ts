import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PricingModule } from '../pricing/pricing.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [PricingModule, JobsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
