import { Module } from '@nestjs/common';
import { DataRequestsController } from './data-requests.controller';
import { DataRequestsService } from './data-requests.service';

@Module({
  controllers: [DataRequestsController],
  providers: [DataRequestsService],
  exports: [DataRequestsService],
})
export class DataRequestsModule {}
