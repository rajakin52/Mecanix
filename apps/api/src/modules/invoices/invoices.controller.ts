import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  generateInvoiceSchema,
  createStandaloneInvoiceSchema,
  paginationSchema,
} from '@mecanix/validators';
import type {
  GenerateInvoiceInput,
  CreateStandaloneInvoiceInput,
  PaginationInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('invoices')
@UseGuards(TenantGuard, RolesGuard, CapabilityGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
  @RequiresCapability('invoices.generate')
  async generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(generateInvoiceSchema)) body: GenerateInvoiceInput,
  ) {
    return this.invoicesService.generateFromJobCard(tenantId, user.id, body);
  }

  @Post('standalone')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async createStandalone(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createStandaloneInvoiceSchema)) body: CreateStandaloneInvoiceInput,
  ) {
    return this.invoicesService.createStandalone(tenantId, user.id, body);
  }

  @Post(':id/send')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async send(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.sendInvoice(tenantId, id);
  }

  @Post(':id/payment-link')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async createPaymentLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.createPaymentLink(tenantId, id);
  }

  @Delete(':id/payment-link')
  @Roles('owner', 'manager')
  @RequiresCapability('invoices.refund')
  async revokePaymentLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.revokePaymentLink(tenantId, id);
  }

  @Post(':id/payment-reminder')
  @Roles('owner', 'manager', 'receptionist')
  @RequiresCapability('invoices.generate')
  async sendPaymentReminder(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.sendInvoicePaymentReminder(tenantId, id);
  }
}

// Public endpoints — the token IS the authorisation. No tenant guard.
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token')
  async getByToken(@Param('token') token: string) {
    if (!token || token.length < 16) throw new NotFoundException('Invalid link');
    return this.invoicesService.getPublicByToken(token);
  }
}
