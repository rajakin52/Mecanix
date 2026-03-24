import { Module } from '@nestjs/common';
import { TecDocController } from './tecdoc.controller';
import { TecDocService } from './tecdoc.service';

@Module({
  controllers: [TecDocController],
  providers: [TecDocService],
  exports: [TecDocService],
})
export class TecDocModule {}
