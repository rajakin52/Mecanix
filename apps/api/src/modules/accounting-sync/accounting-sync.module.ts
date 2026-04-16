import { Module } from '@nestjs/common';
import { AccountingSyncController } from './accounting-sync.controller';
import { AccountingSyncService } from './accounting-sync.service';

@Module({
  controllers: [AccountingSyncController],
  providers: [AccountingSyncService],
  exports: [AccountingSyncService],
})
export class AccountingSyncModule {}
