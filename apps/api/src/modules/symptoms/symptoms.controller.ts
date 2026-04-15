import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createSymptomCodeSchema } from '@mecanix/validators';
import type { CreateSymptomCodeInput } from '@mecanix/validators';

@Controller('symptoms')
@UseGuards(TenantGuard)
export class SymptomsController {
  constructor(private readonly symptomsService: SymptomsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('family') family?: string,
    @Query('search') search?: string,
  ) {
    return this.symptomsService.list(tenantId, family, search);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createSymptomCodeSchema)) body: CreateSymptomCodeInput,
  ) {
    return this.symptomsService.create(tenantId, body);
  }
}
