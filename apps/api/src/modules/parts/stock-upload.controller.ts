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
    @Body() body: { csvContent: string },
  ) {
    if (!body.csvContent) {
      return { error: 'No CSV content provided' };
    }
    return this.stockUploadService.processUpload(
      tenantId,
      user.id,
      Buffer.from(body.csvContent, 'utf-8'),
    );
  }
}
