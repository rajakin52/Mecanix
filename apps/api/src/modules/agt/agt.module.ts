import { Module } from '@nestjs/common';
import { AgtController } from './agt.controller';
import { AgtService } from './agt.service';
import { HashService } from './hash.service';

@Module({
  controllers: [AgtController],
  providers: [AgtService, HashService],
  exports: [AgtService, HashService],
})
export class AgtModule {}
