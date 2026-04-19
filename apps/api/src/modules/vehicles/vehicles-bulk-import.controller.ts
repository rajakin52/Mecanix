import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { VehiclesBulkImportService } from './vehicles-bulk-import.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('vehicles/bulk-import')
@UseGuards(TenantGuard)
export class VehiclesBulkImportController {
  constructor(private readonly service: VehiclesBulkImportService) {}

  @Get('template')
  async downloadTemplate() {
    const buffer = this.service.generateTemplate();
    return {
      fileName: 'vehicles-bulk-import-template.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
  }

  @Post()
  async upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { fileName: string; base64: string },
  ) {
    if (!body?.base64) return { error: 'No file content provided' };
    const buffer = Buffer.from(body.base64, 'base64');
    return this.service.processUpload(
      tenantId,
      user.id,
      buffer,
      body.fileName ?? 'upload.csv',
    );
  }
}
