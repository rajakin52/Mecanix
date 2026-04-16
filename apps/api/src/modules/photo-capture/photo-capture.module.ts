import { Module } from '@nestjs/common';
import { PhotoCaptureController } from './photo-capture.controller';
import { PhotoCaptureService } from './photo-capture.service';

@Module({
  controllers: [PhotoCaptureController],
  providers: [PhotoCaptureService],
  exports: [PhotoCaptureService],
})
export class PhotoCaptureModule {}
