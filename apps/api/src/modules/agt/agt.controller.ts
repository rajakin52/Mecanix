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
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateAgtConfigSchema,
  createAgtSeriesSchema,
  updateAgtSeriesSchema,
  initializeAgtSeriesSchema,
  type UpdateAgtConfigInput,
  type CreateAgtSeriesInput,
  type UpdateAgtSeriesInput,
  type InitializeAgtSeriesInput,
} from '@mecanix/validators';

@Controller('agt')
@UseGuards(TenantGuard)
export class AgtController {
  constructor(private readonly agtService: AgtService) {}

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
}
