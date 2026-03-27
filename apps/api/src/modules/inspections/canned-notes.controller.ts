import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CannedNotesService } from './canned-notes.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('canned-notes')
@UseGuards(TenantGuard)
export class CannedNotesController {
  constructor(private readonly cannedNotesService: CannedNotesService) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query('category') category?: string) {
    return this.cannedNotesService.list(tenantId, category);
  }

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: { category: string; title: string; content: string }) {
    return this.cannedNotesService.create(tenantId, body);
  }

  @Post('seed-defaults')
  async seedDefaults(@TenantId() tenantId: string) {
    return this.cannedNotesService.seedDefaults(tenantId);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.cannedNotesService.delete(tenantId, id);
  }
}
