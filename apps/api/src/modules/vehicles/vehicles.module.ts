import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VinService } from './vin.service';
import { MakesModelsService } from './makes-models.service';
import { MakesModelsController } from './makes-models.controller';

@Module({
  controllers: [VehiclesController, MakesModelsController],
  providers: [VehiclesService, VinService, MakesModelsService],
  exports: [VehiclesService, VinService, MakesModelsService],
})
export class VehiclesModule {}
