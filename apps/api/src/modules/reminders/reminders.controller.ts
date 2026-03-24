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
import { RemindersService } from './reminders.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createReminderSchema, updateReminderSchema } from '@mecanix/validators';
import type { CreateReminderInput, UpdateReminderInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('reminders')
@UseGuards(TenantGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.remindersService.list(tenantId, vehicleId, status);
  }

  @Get('due')
  async getDue(@TenantId() tenantId: string) {
    return this.remindersService.getDueReminders(tenantId);
  }

  @Get('vehicle/:vehicleId')
  async getByVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.remindersService.getByVehicle(tenantId, vehicleId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createReminderSchema)) body: CreateReminderInput,
  ) {
    return this.remindersService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReminderSchema)) body: UpdateReminderInput,
  ) {
    return this.remindersService.update(tenantId, id, body);
  }

  @Post(':id/send')
  async markAsSent(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.remindersService.markAsSent(tenantId, id);
  }

  @Post(':id/complete')
  async markAsCompleted(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.remindersService.markAsCompleted(tenantId, id);
  }
}
