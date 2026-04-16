import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FleetsService } from './fleets.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('fleets')
@UseGuards(TenantGuard)
export class FleetsController {
  constructor(private readonly fleetsService: FleetsService) {}

  @Get()
  async list(@TenantId() tenantId: string) { return this.fleetsService.list(tenantId); }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id') id: string) { return this.fleetsService.getById(tenantId, id); }

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) { return this.fleetsService.create(tenantId, body); }

  @Patch(':id')
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.fleetsService.update(tenantId, id, body); }

  @Post(':id/vehicles/:vehicleId')
  async assignVehicle(@TenantId() tenantId: string, @Param('id') id: string, @Param('vehicleId') vid: string) { return this.fleetsService.assignVehicle(tenantId, id, vid); }

  @Delete(':id/vehicles/:vehicleId')
  async removeVehicle(@TenantId() tenantId: string, @Param('vehicleId') vid: string) { return this.fleetsService.removeVehicle(tenantId, vid); }

  @Post(':id/pm-schedules')
  async addPmSchedule(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.fleetsService.addPmSchedule(tenantId, id, body); }

  @Get(':id/spend')
  async spendReport(@TenantId() tenantId: string, @Param('id') id: string, @Query('startDate') s?: string, @Query('endDate') e?: string) { return this.fleetsService.spendReport(tenantId, id, s, e); }
}
