import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AgtService } from './agt.service';
import { SaftMonthlyService } from './saft-monthly.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateAgtConfigSchema,
  createAgtSeriesSchema,
  updateAgtSeriesSchema,
  initializeAgtSeriesSchema,
  saftMonthlyExportSchema,
  type UpdateAgtConfigInput,
  type CreateAgtSeriesInput,
  type UpdateAgtSeriesInput,
  type InitializeAgtSeriesInput,
  type SaftMonthlyExportInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('agt')
@UseGuards(TenantGuard)
export class AgtController {
  constructor(
    private readonly agtService: AgtService,
    private readonly saftMonthly: SaftMonthlyService,
  ) {}

  // ── Config ────────────────────────────────────────────────

  @Get('config')
  async getConfig(@TenantId() tenantId: string) {
    return this.agtService.getConfig(tenantId);
  }

  @Put('config')
  async updateConfig(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateAgtConfigSchema)) body: UpdateAgtConfigInput,
  ) {
    return this.agtService.updateConfig(tenantId, body);
  }

  @Post('generate-test-keys')
  async generateTestKeys(@TenantId() tenantId: string) {
    return this.agtService.generateTestKeys(tenantId);
  }

  // ── Document Series ───────────────────────────────────────

  @Get('series')
  async listSeries(@TenantId() tenantId: string) {
    return this.agtService.listSeries(tenantId);
  }

  @Post('series')
  async createSeries(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createAgtSeriesSchema)) body: CreateAgtSeriesInput,
  ) {
    return this.agtService.createSeries(tenantId, body);
  }

  @Patch('series/:id')
  async updateSeries(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAgtSeriesSchema)) body: UpdateAgtSeriesInput,
  ) {
    return this.agtService.updateSeries(tenantId, id, body);
  }

  @Post('series/initialize')
  async initializeDefaultSeries(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(initializeAgtSeriesSchema)) body: InitializeAgtSeriesInput,
  ) {
    return this.agtService.initializeDefaultSeries(tenantId, body.seriesCode);
  }

  // ── SAF-T monthly export ─────────────────────────────────
  @Get('saft-exports')
  async listSaftExports(@TenantId() tenantId: string) {
    return this.saftMonthly.list(tenantId);
  }

  @Post('saft-exports')
  async generateSaftExport(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(saftMonthlyExportSchema)) body: SaftMonthlyExportInput,
  ) {
    return this.saftMonthly.generateMonthly(tenantId, user.id, body.year, body.month);
  }
}
