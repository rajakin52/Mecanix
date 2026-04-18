import { Module } from '@nestjs/common';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';
import { ServiceGroupsController } from './service-groups.controller';
import { ServiceGroupsService } from './service-groups.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CostingService } from './costing.service';
import { StockUploadController } from './stock-upload.controller';
import { StockUploadService } from './stock-upload.service';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';

@Module({
  controllers: [PartsController, ServiceGroupsController, InventoryController, StockUploadController, BulkImportController],
  providers: [PartsService, ServiceGroupsService, InventoryService, CostingService, StockUploadService, BulkImportService],
  exports: [PartsService, InventoryService, CostingService],
})
export class PartsModule {}
