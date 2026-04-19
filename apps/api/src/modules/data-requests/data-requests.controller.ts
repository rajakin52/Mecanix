import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataRequestsService } from './data-requests.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createDataRequestSchema,
  completeDataRequestSchema,
  type CreateDataRequestInput,
  type CompleteDataRequestInput,
} from '@mecanix/validators';

@Controller('data-requests')
@UseGuards(TenantGuard)
export class DataRequestsController {
  constructor(private readonly dataRequestsService: DataRequestsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.dataRequestsService.list(tenantId, status);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createDataRequestSchema)) body: CreateDataRequestInput,
  ) {
    return this.dataRequestsService.create(tenantId, body);
  }

  @Post(':id/process')
  async process(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.dataRequestsService.process(tenantId, id, user.id);
  }

  @Post(':id/complete')
  async complete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeDataRequestSchema)) body: CompleteDataRequestInput,
  ) {
    return this.dataRequestsService.complete(
      tenantId,
      id,
      user.id,
      body.exportUrl,
    );
  }

  @Get('customer/:customerId/export-data')
  async getCustomerData(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.dataRequestsService.getCustomerData(tenantId, customerId);
  }
}
