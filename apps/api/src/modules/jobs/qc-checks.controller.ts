import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { QcChecksService } from './qc-checks.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { upsertJobQcSchema } from '@mecanix/validators';
import type { UpsertJobQcInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('jobs/:jobId/qc')
@UseGuards(TenantGuard)
export class QcChecksController {
  constructor(private readonly qcService: QcChecksService) {}

  @Get()
  async get(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.qcService.getByJob(tenantId, jobId);
  }

  @Put()
  async upsert(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(upsertJobQcSchema)) body: UpsertJobQcInput,
  ) {
    return this.qcService.upsert(tenantId, jobId, user.id, body);
  }
}
