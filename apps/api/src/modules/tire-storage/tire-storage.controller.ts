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
import { TireStorageService } from './tire-storage.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createTireStorageSchema,
  updateTireStorageSchema,
  changeTireStorageStatusSchema,
} from '@mecanix/validators';
import type {
  CreateTireStorageInput,
  UpdateTireStorageInput,
  ChangeTireStorageStatusInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('tire-storage')
@UseGuards(TenantGuard)
export class TireStorageController {
  constructor(private readonly service: TireStorageService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.service.list(tenantId, { status, customerId, vehicleId });
  }

  @Get('summary')
  async summary(@TenantId() tenantId: string) {
    return this.service.summary(tenantId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createTireStorageSchema)) body: CreateTireStorageInput,
  ) {
    return this.service.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTireStorageSchema)) body: UpdateTireStorageInput,
  ) {
    return this.service.update(tenantId, id, user.id, body);
  }

  @Post(':id/status')
  async changeStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeTireStorageStatusSchema)) body: ChangeTireStorageStatusInput,
  ) {
    return this.service.changeStatus(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(tenantId, id);
  }
}
