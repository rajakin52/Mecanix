import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('receptions')
@UseGuards(TenantGuard)
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.receptionsService.create(tenantId, user.id, body as never);
  }

  @Get('job/:jobCardId')
  async getByJobCard(
    @TenantId() tenantId: string,
    @Param('jobCardId') jobCardId: string,
  ) {
    return this.receptionsService.getByJobCard(tenantId, jobCardId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    const reception = await this.receptionsService.getByJobCard(tenantId, id);
    if (!reception) {
      return this.receptionsService.getById(tenantId, id);
    }
    return reception;
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.receptionsService.update(tenantId, id, body as never);
  }

  // ── Damage Points ──

  @Post(':id/damage-points')
  async addDamagePoint(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.receptionsService.addDamagePoint(tenantId, id, body as never);
  }

  @Delete(':id/damage-points/:pointId')
  async removeDamagePoint(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('pointId') pointId: string,
  ) {
    return this.receptionsService.removeDamagePoint(tenantId, id, pointId);
  }

  // ── Checklist ──

  @Post(':id/checklist')
  async saveChecklist(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { items: Array<Record<string, unknown>> },
  ) {
    return this.receptionsService.saveChecklist(tenantId, id, body.items as never);
  }

  // ── Signature ──

  @Post(':id/sign')
  async sign(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.receptionsService.sign(tenantId, id, body as never);
  }

  // ── Complete ──

  @Post(':id/complete')
  async complete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.receptionsService.complete(tenantId, id);
  }
}
