import { Module } from '@nestjs/common';
import { PartsRequestsController } from './parts-requests.controller';
import { PartsRequestsService } from './parts-requests.service';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';

@Module({
  imports: [PurchaseRequestsModule],
  controllers: [PartsRequestsController],
  providers: [PartsRequestsService],
  exports: [PartsRequestsService],
})
export class PartsRequestsModule {}
