import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VinService } from './vin.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VinService],
  exports: [VehiclesService, VinService],
})
export class VehiclesModule {}
