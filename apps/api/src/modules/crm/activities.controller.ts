import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createActivitySchema } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('crm/activities')
@UseGuards(TenantGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.activitiesService.list(tenantId, leadId, customerId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createActivitySchema)) body: Record<string, unknown>,
  ) {
    return this.activitiesService.create(tenantId, user.id, body);
  }
}
