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
import { PartsLinesService } from './parts-lines.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createPartsLineSchema, updatePartsLineSchema } from '@mecanix/validators';
import type { CreatePartsLineInput, UpdatePartsLineInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('jobs/:jobId/parts-lines')
@UseGuards(TenantGuard)
export class PartsLinesController {
  constructor(private readonly partsLinesService: PartsLinesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.partsLinesService.list(tenantId, jobId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(createPartsLineSchema)) body: CreatePartsLineInput,
  ) {
    return this.partsLinesService.create(tenantId, jobId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePartsLineSchema)) body: UpdatePartsLineInput,
  ) {
    return this.partsLinesService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
    @Param('id') id: string,
  ) {
    return this.partsLinesService.delete(tenantId, id, jobId);
  }
}
