import { Module } from '@nestjs/common';
import { TireStorageController } from './tire-storage.controller';
import { TireStorageService } from './tire-storage.service';

@Module({
  controllers: [TireStorageController],
  providers: [TireStorageService],
  exports: [TireStorageService],
})
export class TireStorageModule {}
