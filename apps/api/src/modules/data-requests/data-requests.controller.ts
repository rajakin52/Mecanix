import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataRequestsService } from './data-requests.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('data-requests')
@UseGuards(TenantGuard)
export class DataRequestsController {
  constructor(private readonly dataRequestsService: DataRequestsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.dataRequestsService.list(tenantId, status);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() body: { customerId: string; requestType: string },
  ) {
    return this.dataRequestsService.create(tenantId, body);
  }

  @Post(':id/process')
  async process(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.dataRequestsService.process(tenantId, id, user.id);
  }

  @Post(':id/complete')
  async complete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { exportUrl?: string },
  ) {
    return this.dataRequestsService.complete(
      tenantId,
      id,
      user.id,
      body.exportUrl,
    );
  }

  @Get('customer/:customerId/export-data')
  async getCustomerData(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.dataRequestsService.getCustomerData(tenantId, customerId);
  }
}
