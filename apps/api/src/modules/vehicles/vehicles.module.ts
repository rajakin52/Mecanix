import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VinService } from './vin.service';
import { MakesModelsService } from './makes-models.service';
import { MakesModelsController } from './makes-models.controller';
import { VehiclesBulkImportController } from './vehicles-bulk-import.controller';
import { VehiclesBulkImportService } from './vehicles-bulk-import.service';

@Module({
  controllers: [VehiclesController, MakesModelsController, VehiclesBulkImportController],
  providers: [VehiclesService, VinService, MakesModelsService, VehiclesBulkImportService],
  exports: [VehiclesService, VinService, MakesModelsService],
})
export class VehiclesModule {}
