import { Module } from '@nestjs/common';
import { AgtController } from './agt.controller';
import { AgtService } from './agt.service';
import { HashService } from './hash.service';
import { SaftMonthlyService } from './saft-monthly.service';

@Module({
  controllers: [AgtController],
  providers: [AgtService, HashService, SaftMonthlyService],
  exports: [AgtService, HashService, SaftMonthlyService],
})
export class AgtModule {}
