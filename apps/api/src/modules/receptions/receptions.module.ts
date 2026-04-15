import { Module } from '@nestjs/common';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

@Module({
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
  exports: [ReceptionsService],
})
export class ReceptionsModule {}
