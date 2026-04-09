import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { StatementsService } from './statements.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, StatementsService],
  exports: [ReportsService, StatementsService],
})
export class ReportsModule {}
