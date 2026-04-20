import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LinePhotosService } from './line-photos.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createLinePhotoSchema } from '@mecanix/validators';
import type { CreateLinePhotoInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('jobs/:jobId/line-photos')
@UseGuards(TenantGuard)
export class LinePhotosController {
  constructor(private readonly service: LinePhotosService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
    @Query('lineKind') lineKind?: 'parts' | 'labour',
    @Query('lineId') lineId?: string,
  ) {
    if (lineKind && lineId) {
      return this.service.listForLine(tenantId, lineKind, lineId);
    }
    return this.service.listForJob(tenantId, jobId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(createLinePhotoSchema)) body: CreateLinePhotoInput,
  ) {
    return this.service.create(tenantId, jobId, user.id, body);
  }

  @Delete(':photoId')
  async delete(
    @TenantId() tenantId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.service.delete(tenantId, photoId);
  }
}
