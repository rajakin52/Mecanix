import {
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { StockUploadService } from './stock-upload.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('parts/stock-upload')
@UseGuards(TenantGuard)
export class StockUploadController {
  constructor(private readonly stockUploadService: StockUploadService) {}

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.stockUploadService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'text/csv',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=stock-upload-template.csv',
    );
    res.send(buffer);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    return this.stockUploadService.processUpload(tenantId, user.id, file.buffer);
  }
}
