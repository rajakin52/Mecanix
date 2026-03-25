import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ErpIntegrationService } from './erp-integration.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('erp')
@UseGuards(TenantGuard)
export class ErpIntegrationController {
  constructor(private readonly service: ErpIntegrationService) {}

  @Get('config')
  async getConfig(@TenantId() tenantId: string) {
    return this.service.getConfig(tenantId);
  }

  @Put('config')
  async saveConfig(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.saveConfig(tenantId, user.id, body);
  }

  @Post('test-connection')
  async testConnection(@TenantId() tenantId: string) {
    return this.service.testConnection(tenantId);
  }

  @Post('export-invoice/:invoiceId')
  async exportInvoice(
    @TenantId() tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.exportInvoice(tenantId, invoiceId);
  }

  @Get('export-log')
  async getExportLog(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.service.getExportLog(tenantId, status);
  }

  @Post('retry/:exportLogId')
  async retryExport(
    @TenantId() tenantId: string,
    @Param('exportLogId') exportLogId: string,
  ) {
    return this.service.retryExport(tenantId, exportLogId);
  }
}
