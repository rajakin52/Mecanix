import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GatePassService } from './gate-pass.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createGatePassSchema } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('gate-passes')
@UseGuards(TenantGuard)
export class GatePassController {
  constructor(private readonly gatePassService: GatePassService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('jobCardId') jobCardId?: string,
  ) {
    return this.gatePassService.list(tenantId, jobCardId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.gatePassService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createGatePassSchema)) body: Record<string, unknown>,
  ) {
    return this.gatePassService.create(tenantId, user.id, body);
  }
}
