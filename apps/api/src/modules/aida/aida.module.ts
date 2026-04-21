import { Module } from '@nestjs/common';
import { AidaController } from './aida.controller';
import { AidaService } from './aida.service';

@Module({
  controllers: [AidaController],
  providers: [AidaService],
  exports: [AidaService],
})
export class AidaModule {}
