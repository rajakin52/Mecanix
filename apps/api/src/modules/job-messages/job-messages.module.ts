import { Module } from '@nestjs/common';
import { JobMessagesController } from './job-messages.controller';
import { JobMessagesService } from './job-messages.service';

@Module({
  controllers: [JobMessagesController],
  providers: [JobMessagesService],
  exports: [JobMessagesService],
})
export class JobMessagesModule {}
