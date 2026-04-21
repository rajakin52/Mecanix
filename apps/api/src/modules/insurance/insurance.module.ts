import { Module } from '@nestjs/common';
import { InsuranceCompaniesController } from './insurance-companies.controller';
import { InsuranceCompaniesService } from './insurance-companies.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { ClaimPacketsController } from './claim-packets.controller';
import { ClaimPacketsService } from './claim-packets.service';

@Module({
  controllers: [InsuranceCompaniesController, ClaimsController, EstimatesController, ClaimPacketsController],
  providers: [InsuranceCompaniesService, ClaimsService, EstimatesService, ClaimPacketsService],
  exports: [InsuranceCompaniesService, ClaimsService, EstimatesService, ClaimPacketsService],
})
export class InsuranceModule {}
