import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createVehicleSchema, updateVehicleSchema, paginationSchema } from '@mecanix/validators';
import type { CreateVehicleInput, UpdateVehicleInput, PaginationInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('vehicles')
@UseGuards(TenantGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('customerId') customerId?: string,
  ) {
    return this.vehiclesService.list(tenantId, query, customerId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.vehiclesService.getById(tenantId, id);
  }

  @Get(':id/history')
  async getHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.vehiclesService.getHistory(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput,
  ) {
    return this.vehiclesService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) body: UpdateVehicleInput,
  ) {
    return this.vehiclesService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.vehiclesService.delete(tenantId, id, user.id);
  }

  @Post(':id/photos')
  async uploadPhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { file: string; filename: string },
  ) {
    const buffer = Buffer.from(body.file, 'base64');
    return this.vehiclesService.uploadPhoto(tenantId, id, user.id, buffer, body.filename);
  }
}
