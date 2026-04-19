import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StockUploadService } from './stock-upload.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { csvUploadSchema, type CsvUploadInput } from '@mecanix/validators';

@Controller('parts/stock-upload')
@UseGuards(TenantGuard)
export class StockUploadController {
  constructor(private readonly stockUploadService: StockUploadService) {}

  @Get('template')
  async downloadTemplate() {
    const csv = this.stockUploadService.generateTemplate();
    return { template: csv };
  }

  @Post()
  async upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(csvUploadSchema)) body: CsvUploadInput,
  ) {
    return this.stockUploadService.processUpload(
      tenantId,
      user.id,
      Buffer.from(body.csvContent, 'utf-8'),
    );
  }
}
