import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PartsRequestsService } from './parts-requests.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('parts-requests')
@UseGuards(TenantGuard)
export class PartsRequestsController {
  constructor(private readonly partsRequestsService: PartsRequestsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('jobCardId') jobCardId?: string,
  ) {
    return this.partsRequestsService.list(tenantId, status, jobCardId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.partsRequestsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      jobCardId: string;
      priority?: string;
      oldPartPhoto?: string;
      oldPartNote?: string;
      warehouseId?: string;
      items: Array<{
        partId: string;
        quantity: number;
      }>;
    },
  ) {
    return this.partsRequestsService.create(tenantId, user.id, body);
  }

  @Post(':id/pick')
  async startPicking(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.partsRequestsService.startPicking(tenantId, id, user.id);
  }

  @Patch(':id/items/:itemId/picked')
  async markItemPicked(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.partsRequestsService.markItemPicked(tenantId, id, itemId);
  }

  @Patch(':id/items/:itemId/unavailable')
  async markItemUnavailable(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.partsRequestsService.markItemUnavailable(tenantId, id, itemId);
  }

  @Post(':id/ready')
  async markReady(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.partsRequestsService.markReady(tenantId, id);
  }

  @Post(':id/issue')
  async issueParts(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.partsRequestsService.issueParts(tenantId, id, user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.partsRequestsService.cancel(tenantId, id, body.reason);
  }
}
