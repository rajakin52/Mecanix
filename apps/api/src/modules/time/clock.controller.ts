import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClockService } from './clock.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { clockInSchema, clockOutSchema } from '@mecanix/validators';
import type { ClockInInput, ClockOutInput } from '@mecanix/validators';

@Controller('clock')
@UseGuards(TenantGuard)
export class ClockController {
  constructor(private readonly clockService: ClockService) {}

  @Post('in')
  async clockIn(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(clockInSchema)) body: ClockInInput,
  ) {
    return this.clockService.clockIn(tenantId, body.technicianId);
  }

  @Post('out')
  async clockOut(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(clockOutSchema)) body: ClockOutInput,
  ) {
    return this.clockService.clockOut(tenantId, body.technicianId);
  }

  @Get('today/:technicianId')
  async getToday(
    @TenantId() tenantId: string,
    @Param('technicianId') technicianId: string,
  ) {
    return this.clockService.getTodayRecord(tenantId, technicianId);
  }

  @Get('history/:technicianId')
  async getHistory(
    @TenantId() tenantId: string,
    @Param('technicianId') technicianId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.clockService.getHistory(tenantId, technicianId, startDate, endDate);
  }
}
