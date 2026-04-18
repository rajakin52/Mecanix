import { Module } from '@nestjs/common';
import { PhotoCaptureController } from './photo-capture.controller';
import { PhotoCaptureService } from './photo-capture.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PhotoCaptureController],
  providers: [PhotoCaptureService],
  exports: [PhotoCaptureService],
})
export class PhotoCaptureModule {}
