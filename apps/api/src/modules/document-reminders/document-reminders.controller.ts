import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentRemindersService } from './document-reminders.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createDocumentReminderSchema } from '@mecanix/validators';
import type { CreateDocumentReminderInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('document-reminders')
@UseGuards(TenantGuard)
export class DocumentRemindersController {
  constructor(private readonly documentRemindersService: DocumentRemindersService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.documentRemindersService.list(tenantId, vehicleId, status);
  }

  @Get('due')
  async getDue(@TenantId() tenantId: string) {
    return this.documentRemindersService.getDue(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createDocumentReminderSchema)) body: CreateDocumentReminderInput,
  ) {
    return this.documentRemindersService.create(tenantId, user.id, body);
  }

  @Post(':id/renew')
  async markRenewed(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.documentRemindersService.markRenewed(tenantId, id);
  }
}
