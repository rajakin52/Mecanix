import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';
import { StockCountController } from './stock-count.controller';
import { StockCountService } from './stock-count.service';

@Module({
  controllers: [WarehouseController, StockTransferController, StockCountController],
  providers: [WarehouseService, StockTransferService, StockCountService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
