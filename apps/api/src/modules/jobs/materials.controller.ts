import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { MaterialsService } from './materials.service';

@Controller('jobs')
@UseGuards(TenantGuard)
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get(':id/materials-preview')
  async preview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.materials.preview(tenantId, id);
  }

  @Post(':id/materials-apply')
  async apply(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.materials.apply(tenantId, id, user.id);
  }
}
