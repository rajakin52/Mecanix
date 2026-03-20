import { Module } from '@nestjs/common';
import { InsuranceCompaniesController } from './insurance-companies.controller';
import { InsuranceCompaniesService } from './insurance-companies.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  controllers: [InsuranceCompaniesController, ClaimsController, EstimatesController],
  providers: [InsuranceCompaniesService, ClaimsService, EstimatesService],
  exports: [InsuranceCompaniesService, ClaimsService, EstimatesService],
})
export class InsuranceModule {}
