import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PettyCashService } from './petty-cash.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createPettyCashSchema } from '@mecanix/validators';
import type { CreatePettyCashInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('petty-cash')
@UseGuards(TenantGuard)
export class PettyCashController {
  constructor(private readonly pettyCashService: PettyCashService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.pettyCashService.list(tenantId, startDate, endDate);
  }

  @Get('balance')
  async getBalance(@TenantId() tenantId: string) {
    return this.pettyCashService.getBalance(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPettyCashSchema)) body: CreatePettyCashInput,
  ) {
    return this.pettyCashService.create(tenantId, user.id, body);
  }
}
