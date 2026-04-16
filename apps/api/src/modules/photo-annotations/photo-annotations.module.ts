import { Module } from '@nestjs/common';
import { PhotoAnnotationsController } from './photo-annotations.controller';
import { PhotoAnnotationsService } from './photo-annotations.service';

@Module({
  controllers: [PhotoAnnotationsController],
  providers: [PhotoAnnotationsService],
  exports: [PhotoAnnotationsService],
})
export class PhotoAnnotationsModule {}
