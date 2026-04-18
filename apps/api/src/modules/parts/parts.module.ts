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
import { StockPolicyController } from './stock-policy.controller';
import { StockPolicyService } from './stock-policy.service';

@Module({
  controllers: [PartsController, ServiceGroupsController, InventoryController, StockUploadController, BulkImportController, StockPolicyController],
  providers: [PartsService, ServiceGroupsService, InventoryService, CostingService, StockUploadService, BulkImportService, StockPolicyService],
  exports: [PartsService, InventoryService, CostingService, StockPolicyService],
})
export class PartsModule {}
