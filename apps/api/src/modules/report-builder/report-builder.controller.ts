import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ReportBuilderService } from './report-builder.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('report-builder')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class ReportBuilderController {
  constructor(private readonly service: ReportBuilderService) {}

  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Post('run')
  async run(
    @TenantId() tenantId: string,
    @Body() body: { reportType: string; filters?: Record<string, unknown> },
  ) {
    return this.service.run(tenantId, body.reportType, body.filters ?? {});
  }

  @Post('export-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @TenantId() tenantId: string,
    @Body() body: { reportType: string; filters?: Record<string, unknown> },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { rows, columns, name } = await this.service.run(tenantId, body.reportType, body.filters ?? {});
    const csv = this.service.toCsv(columns, rows);
    const safe = name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
    res.header('Content-Disposition', `attachment; filename="${safe}.csv"`);
    return csv;
  }

  @Get('saved')
  async list(@TenantId() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Get('saved/:id')
  async get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getById(tenantId, id);
  }

  @Post('saved')
  async save(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { name: string; description?: string; reportType: string; filters: Record<string, unknown> },
  ) {
    return this.service.save(tenantId, user.id, body);
  }

  @Patch('saved/:id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; filters?: Record<string, unknown> },
  ) {
    return this.service.update(tenantId, id, body);
  }

  @Delete('saved/:id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }

  // Convenience runners for a saved report
  @Post('saved/:id/run')
  async runSaved(@TenantId() tenantId: string, @Param('id') id: string) {
    const saved = await this.service.getById(tenantId, id);
    return this.service.run(
      tenantId,
      saved.report_type as string,
      (saved.filters as Record<string, unknown>) ?? {},
    );
  }

  @Post('saved/:id/export-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportSavedCsv(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('name') nameOverride: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const saved = await this.service.getById(tenantId, id);
    const { rows, columns, name } = await this.service.run(
      tenantId,
      saved.report_type as string,
      (saved.filters as Record<string, unknown>) ?? {},
    );
    const csv = this.service.toCsv(columns, rows);
    const safe = (nameOverride || name).replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
    res.header('Content-Disposition', `attachment; filename="${safe}.csv"`);
    return csv;
  }
}
