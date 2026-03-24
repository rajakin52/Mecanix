import { Module } from '@nestjs/common';
import { GatePassController } from './gate-pass.controller';
import { GatePassService } from './gate-pass.service';

@Module({
  controllers: [GatePassController],
  providers: [GatePassService],
  exports: [GatePassService],
})
export class GatePassModule {}
