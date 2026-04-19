import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { VehiclesBulkImportService } from './vehicles-bulk-import.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { fileUploadSchema, type FileUploadInput } from '@mecanix/validators';

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
    @Body(new ZodValidationPipe(fileUploadSchema)) body: FileUploadInput,
  ) {
    const buffer = Buffer.from(body.base64, 'base64');
    return this.service.processUpload(
      tenantId,
      user.id,
      buffer,
      body.fileName,
    );
  }
}
