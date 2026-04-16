import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccountingSyncService } from './accounting-sync.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('accounting')
@UseGuards(TenantGuard)
export class AccountingSyncController {
  constructor(private readonly accountingSyncService: AccountingSyncService) {}

  @Get('connections')
  async listConnections(@TenantId() tenantId: string) {
    return this.accountingSyncService.listConnections(tenantId);
  }

  @Post('connections')
  async createConnection(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.accountingSyncService.createConnection(tenantId, body as never);
  }

  @Patch('connections/:id')
  async updateConnection(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accountingSyncService.updateConnection(tenantId, id, body as never);
  }

  @Delete('connections/:id')
  async deleteConnection(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.accountingSyncService.deleteConnection(tenantId, id);
  }

  @Post('connections/:id/sync-invoice/:invoiceId')
  async syncInvoice(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.accountingSyncService.syncInvoice(tenantId, id, invoiceId);
  }

  @Post('connections/:id/sync-customer/:customerId')
  async syncCustomer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('customerId') customerId: string,
  ) {
    return this.accountingSyncService.syncCustomer(tenantId, id, customerId);
  }

  @Get('connections/:id/logs')
  async getSyncLog(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.accountingSyncService.getSyncLog(tenantId, id);
  }
}
