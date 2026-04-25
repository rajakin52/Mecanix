import { Module } from '@nestjs/common';
import { PartsRequestsController } from './parts-requests.controller';
import { PartsRequestsService } from './parts-requests.service';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [PurchaseRequestsModule, WarehouseModule],
  controllers: [PartsRequestsController],
  providers: [PartsRequestsService],
  exports: [PartsRequestsService],
})
export class PartsRequestsModule {}
