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
import { AppointmentsService } from './appointments.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  changeAppointmentStatusSchema,
} from '@mecanix/validators';
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ChangeAppointmentStatusInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('appointments')
@UseGuards(TenantGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.appointmentsService.list(tenantId, { date, status, technicianId });
  }

  @Get('date/:date')
  async getByDate(
    @TenantId() tenantId: string,
    @Param('date') date: string,
  ) {
    return this.appointmentsService.getByDate(tenantId, date);
  }

  @Get('slots/:date')
  async getAvailableSlots(
    @TenantId() tenantId: string,
    @Param('date') date: string,
    @Query('duration') duration?: string,
  ) {
    const durationMinutes = duration ? parseInt(duration, 10) : 60;
    return this.appointmentsService.getAvailableSlots(tenantId, date, durationMinutes);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput,
  ) {
    return this.appointmentsService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
  ) {
    return this.appointmentsService.update(tenantId, id, user.id, body);
  }

  @Post(':id/status')
  async changeStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeAppointmentStatusSchema)) body: ChangeAppointmentStatusInput,
  ) {
    return this.appointmentsService.updateStatus(tenantId, id, body.status);
  }
}
