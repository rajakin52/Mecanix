import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ClaimPacketsService } from './claim-packets.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('insurance/claims/:claimId/packets')
@UseGuards(TenantGuard)
export class ClaimPacketsController {
  constructor(private readonly service: ClaimPacketsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Param('claimId') claimId: string,
  ) {
    return this.service.list(tenantId, claimId);
  }

  @Post()
  async generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('claimId') claimId: string,
  ) {
    return this.service.generate(tenantId, claimId, user.id);
  }

  @Post(':packetId/submit')
  async submit(
    @TenantId() tenantId: string,
    @Param('packetId') packetId: string,
    @Body() body: { channel: 'email' | 'api' | 'manual_portal'; recipient?: string },
  ) {
    return this.service.submit(tenantId, packetId, body);
  }

  @Post(':packetId/response')
  async recordResponse(
    @TenantId() tenantId: string,
    @Param('packetId') packetId: string,
    @Body() body: { status: 'acknowledged' | 'approved' | 'rejected' | 'supplement_requested'; notes?: string },
  ) {
    return this.service.recordResponse(tenantId, packetId, body);
  }
}
