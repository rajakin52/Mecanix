import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('audit-log')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.list(tenantId, {
      action,
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
    });
  }

  @Get('actions')
  async listActions(@TenantId() tenantId: string) {
    return this.service.distinctActions(tenantId);
  }
}
