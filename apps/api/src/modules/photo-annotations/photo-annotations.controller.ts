import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PhotoAnnotationsService } from './photo-annotations.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('photo-annotations')
@UseGuards(TenantGuard)
export class PhotoAnnotationsController {
  constructor(private readonly photoAnnotationsService: PhotoAnnotationsService) {}

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    const userId = (body.userId as string) ?? '';
    return this.photoAnnotationsService.create(tenantId, userId, body as never);
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
    @Body() body: Record<string, unknown>,
  ) {
    return this.photoAnnotationsService.update(tenantId, id, body.annotations as never);
  }
}
