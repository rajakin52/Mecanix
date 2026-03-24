import { Module } from '@nestjs/common';
import { DocumentRemindersController } from './document-reminders.controller';
import { DocumentRemindersService } from './document-reminders.service';

@Module({
  controllers: [DocumentRemindersController],
  providers: [DocumentRemindersService],
  exports: [DocumentRemindersService],
})
export class DocumentRemindersModule {}
