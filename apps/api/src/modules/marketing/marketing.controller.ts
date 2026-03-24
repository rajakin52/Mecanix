import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createCampaignSchema } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('marketing')
@UseGuards(TenantGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('campaigns')
  async list(@TenantId() tenantId: string) {
    return this.marketingService.list(tenantId);
  }

  @Post('campaigns')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCampaignSchema)) body: Record<string, unknown>,
  ) {
    return this.marketingService.create(tenantId, user.id, body);
  }

  @Get('campaigns/:id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.marketingService.getById(tenantId, id);
  }

  @Get('campaigns/:id/recipients')
  async getRecipients(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    const recipients = await this.marketingService.getRecipients(tenantId, id);
    return { recipients, count: recipients.length };
  }

  @Post('campaigns/:id/send')
  async send(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.marketingService.send(tenantId, id);
  }
}
