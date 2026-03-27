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

  // ── Inspection Templates ──────────────────────────────────

  @Get('templates')
  async listTemplates(@TenantId() tenantId: string) {
    return this.inspectionsService.listTemplates(tenantId);
  }

  @Post('templates')
  async createTemplate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.inspectionsService.createTemplate(tenantId, user.id, body);
  }

  @Post('templates/initialize-default')
  async initializeDefault(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inspectionsService.initializeDefaultTemplate(tenantId, user.id);
  }

  // ── DVI Items ─────────────────────────────────────────────

  @Patch('items/:itemId')
  async updateDviItem(
    @TenantId() tenantId: string,
    @Param('itemId') itemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.inspectionsService.updateDviItem(tenantId, itemId, body);
  }
}
