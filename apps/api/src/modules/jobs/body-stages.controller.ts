import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BodyStagesService } from './body-stages.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { upsertJobBodyStagesSchema } from '@mecanix/validators';
import type { UpsertJobBodyStagesInput } from '@mecanix/validators';

@Controller('jobs/:jobId/body-stages')
@UseGuards(TenantGuard)
export class BodyStagesController {
  constructor(private readonly service: BodyStagesService) {}

  @Get()
  async get(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.getByJob(tenantId, jobId);
  }

  @Put()
  async upsert(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(upsertJobBodyStagesSchema)) body: UpsertJobBodyStagesInput,
  ) {
    return this.service.upsert(tenantId, jobId, body);
  }
}
