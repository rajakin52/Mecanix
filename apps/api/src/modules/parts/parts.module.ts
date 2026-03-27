import { Module } from '@nestjs/common';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';
import { ServiceGroupsController } from './service-groups.controller';
import { ServiceGroupsService } from './service-groups.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CostingService } from './costing.service';

@Module({
  controllers: [PartsController, ServiceGroupsController, InventoryController],
  providers: [PartsService, ServiceGroupsService, InventoryService, CostingService],
  exports: [PartsService, InventoryService, CostingService],
})
export class PartsModule {}
