import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UpsellService } from './upsell.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createUpsellItemSchema, updateUpsellItemSchema } from '@mecanix/validators';
import type { CreateUpsellItemInput, UpdateUpsellItemInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('upsell-items')
@UseGuards(TenantGuard)
export class UpsellController {
  constructor(private readonly upsellService: UpsellService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('applicableTo') applicableTo?: string,
  ) {
    return this.upsellService.list(tenantId, applicableTo);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.upsellService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createUpsellItemSchema)) body: CreateUpsellItemInput,
  ) {
    return this.upsellService.create(tenantId, user.id, body);
  }

  @Post('seed-defaults')
  async seedDefaults(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.upsellService.seedDefaults(tenantId, user.id);
    return { seeded: true };
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUpsellItemSchema)) body: UpdateUpsellItemInput,
  ) {
    return this.upsellService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.upsellService.delete(tenantId, id);
  }
}
