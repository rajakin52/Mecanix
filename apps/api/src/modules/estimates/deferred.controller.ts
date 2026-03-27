import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeferredServicesService } from './deferred.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('deferred-services')
@UseGuards(TenantGuard)
export class DeferredServicesController {
  constructor(private readonly deferredService: DeferredServicesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.deferredService.list(tenantId, status, vehicleId, customerId);
  }

  @Get('due')
  async getDue(@TenantId() tenantId: string) {
    return this.deferredService.getDueForFollowUp(tenantId);
  }

  @Get('summary')
  async getSummary(@TenantId() tenantId: string) {
    return this.deferredService.getSummary(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() body: {
      customerId: string;
      vehicleId: string;
      description: string;
      estimatedCost?: number;
      priority?: string;
      followUpDate?: string;
    },
  ) {
    return this.deferredService.create(tenantId, body);
  }

  @Post(':id/convert')
  async convert(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { jobCardId: string },
  ) {
    return this.deferredService.convertToJob(tenantId, id, body.jobCardId);
  }

  @Post(':id/remind')
  async remind(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.deferredService.markReminded(tenantId, id);
  }
}
