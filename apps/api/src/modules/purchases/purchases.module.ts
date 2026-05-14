import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { PartsModule } from '../parts/parts.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PartsModule, WarehouseModule, NotificationsModule],
  controllers: [VendorsController, PurchaseOrdersController, BillsController],
  providers: [VendorsService, PurchaseOrdersService, BillsService],
  exports: [VendorsService, PurchaseOrdersService, BillsService],
})
export class PurchasesModule {}
