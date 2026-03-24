import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  generateInvoiceSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  GenerateInvoiceInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('invoices')
@UseGuards(TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.invoicesService.list(tenantId, query, { status, customerId });
  }

  @Get('summary')
  async getFinancialSummary(@TenantId() tenantId: string) {
    return this.invoicesService.getFinancialSummary(tenantId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.getById(tenantId, id);
  }

  @Post('generate')
  @Roles('owner', 'manager', 'receptionist')
  async generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(generateInvoiceSchema)) body: GenerateInvoiceInput,
  ) {
    return this.invoicesService.generateFromJobCard(tenantId, user.id, body);
  }

  @Post(':id/send')
  @Roles('owner', 'manager', 'receptionist')
  async send(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.sendInvoice(tenantId, id);
  }
}
