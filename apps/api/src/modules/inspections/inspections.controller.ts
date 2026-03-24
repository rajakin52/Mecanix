import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createInspectionSchema,
  updateInspectionSchema,
} from '@mecanix/validators';
import type {
  CreateInspectionInput,
  UpdateInspectionInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('inspections')
@UseGuards(TenantGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createInspectionSchema)) body: CreateInspectionInput,
  ) {
    return this.inspectionsService.create(tenantId, user.id, body);
  }

  @Get('job/:jobCardId')
  async getByJobCard(
    @TenantId() tenantId: string,
    @Param('jobCardId') jobCardId: string,
  ) {
    return this.inspectionsService.getByJobCard(tenantId, jobCardId);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInspectionSchema)) body: UpdateInspectionInput,
  ) {
    return this.inspectionsService.update(tenantId, id, user.id, body);
  }
}
