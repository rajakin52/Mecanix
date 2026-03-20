import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TimeService } from './time.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { startTimerSchema, stopTimerSchema } from '@mecanix/validators';
import type { StartTimerInput, StopTimerInput } from '@mecanix/validators';

@Controller('time')
@UseGuards(TenantGuard)
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Post('start')
  async startTimer(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(startTimerSchema)) body: StartTimerInput,
  ) {
    return this.timeService.startTimer(tenantId, body.technicianId, body.jobCardId);
  }

  @Post(':id/pause')
  async pauseTimer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.timeService.pauseTimer(tenantId, id);
  }

  @Post(':id/resume')
  async resumeTimer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.timeService.resumeTimer(tenantId, id);
  }

  @Post(':id/stop')
  async stopTimer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(stopTimerSchema)) body: StopTimerInput,
  ) {
    return this.timeService.stopTimer(tenantId, id, body.notes);
  }

  @Get('active/:technicianId')
  async getActiveTimer(
    @TenantId() tenantId: string,
    @Param('technicianId') technicianId: string,
  ) {
    return this.timeService.getActiveTimer(tenantId, technicianId);
  }

  @Get('technician/:technicianId')
  async listByTechnician(
    @TenantId() tenantId: string,
    @Param('technicianId') technicianId: string,
    @Query('date') date?: string,
  ) {
    return this.timeService.listByTechnician(tenantId, technicianId, date);
  }

  @Get('job/:jobCardId')
  async listByJob(
    @TenantId() tenantId: string,
    @Param('jobCardId') jobCardId: string,
  ) {
    return this.timeService.listByJob(tenantId, jobCardId);
  }

  @Get('stats/:technicianId')
  async getTechnicianStats(
    @TenantId() tenantId: string,
    @Param('technicianId') technicianId: string,
    @Query('date') date: string,
  ) {
    return this.timeService.getTechnicianStats(tenantId, technicianId, date);
  }
}
