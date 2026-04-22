import { Module } from '@nestjs/common';
import { AidaController, AidaStatsController } from './aida.controller';
import { AidaService } from './aida.service';
import { JobsModule } from '../jobs/jobs.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [JobsModule, AiModule],
  controllers: [AidaController, AidaStatsController],
  providers: [AidaService],
  exports: [AidaService],
})
export class AidaModule {}
