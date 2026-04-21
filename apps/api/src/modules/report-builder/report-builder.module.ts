import { Module } from '@nestjs/common';
import { ReportBuilderController } from './report-builder.controller';
import { ReportBuilderService } from './report-builder.service';

@Module({
  controllers: [ReportBuilderController],
  providers: [ReportBuilderService],
  exports: [ReportBuilderService],
})
export class ReportBuilderModule {}
