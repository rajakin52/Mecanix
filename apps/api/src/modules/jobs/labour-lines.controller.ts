import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LabourLinesService } from './labour-lines.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createLabourLineSchema, updateLabourLineSchema } from '@mecanix/validators';
import type { CreateLabourLineInput, UpdateLabourLineInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('jobs/:jobId/labour-lines')
@UseGuards(TenantGuard)
export class LabourLinesController {
  constructor(private readonly labourLinesService: LabourLinesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.labourLinesService.list(tenantId, jobId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(createLabourLineSchema)) body: CreateLabourLineInput,
  ) {
    return this.labourLinesService.create(tenantId, jobId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLabourLineSchema)) body: UpdateLabourLineInput,
  ) {
    return this.labourLinesService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
    @Param('id') id: string,
  ) {
    return this.labourLinesService.delete(tenantId, id, jobId);
  }
}
