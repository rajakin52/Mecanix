import { Controller, Delete, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { CustomerTagsService } from './customer-tags.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { addCustomerTagSchema, type AddCustomerTagInput } from '@mecanix/validators';

@Controller('customer-tags')
@UseGuards(TenantGuard)
export class CustomerTagsController {
  constructor(private readonly tagsService: CustomerTagsService) {}

  @Get('tags')
  async allTags(@TenantId() tenantId: string) { return this.tagsService.allTags(tenantId); }

  @Get('search')
  async searchByTag(@TenantId() tenantId: string, @Query('tag') tag: string) { return this.tagsService.searchByTag(tenantId, tag); }

  @Get('customer/:customerId')
  async listByCustomer(@TenantId() tenantId: string, @Param('customerId') cid: string) { return this.tagsService.listByCustomer(tenantId, cid); }

  @Post('customer/:customerId')
  async addTag(
    @TenantId() tenantId: string,
    @Param('customerId') cid: string,
    @Body(new ZodValidationPipe(addCustomerTagSchema)) body: AddCustomerTagInput,
  ) { return this.tagsService.addTag(tenantId, cid, body.tag); }

  @Delete('customer/:customerId/:tag')
  async removeTag(@TenantId() tenantId: string, @Param('customerId') cid: string, @Param('tag') tag: string) { return this.tagsService.removeTag(tenantId, cid, tag); }

  @Get('customer/:customerId/lifetime-value')
  async lifetimeValue(@TenantId() tenantId: string, @Param('customerId') cid: string) { return this.tagsService.getLifetimeValue(tenantId, cid); }
}
