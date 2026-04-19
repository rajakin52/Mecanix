import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PhotoAnnotationsService } from './photo-annotations.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPhotoAnnotationSchema,
  updatePhotoAnnotationSchema,
  type CreatePhotoAnnotationInput,
  type UpdatePhotoAnnotationInput,
} from '@mecanix/validators';

@Controller('photo-annotations')
@UseGuards(TenantGuard)
export class PhotoAnnotationsController {
  constructor(private readonly photoAnnotationsService: PhotoAnnotationsService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPhotoAnnotationSchema)) body: CreatePhotoAnnotationInput,
  ) {
    return this.photoAnnotationsService.create(tenantId, user.id, body);
  }

  @Get(':entityType/:entityId')
  async getByEntity(
    @TenantId() tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.photoAnnotationsService.getByEntity(tenantId, entityType, entityId);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePhotoAnnotationSchema)) body: UpdatePhotoAnnotationInput,
  ) {
    return this.photoAnnotationsService.update(tenantId, id, body.annotations);
  }
}
