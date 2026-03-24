import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/user.decorator';

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0] as string;
  const endDate = now.toISOString().split('T')[0] as string;
  return { startDate, endDate };
}

@Controller('reports')
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  async revenue(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.revenueReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('jobs')
  async jobs(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.jobCardReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('technicians')
  async technicians(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.technicianReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('parts-usage')
  async partsUsage(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.partsUsageReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('outstanding-invoices')
  async outstandingInvoices(@TenantId() tenantId: string) {
    return this.reportsService.outstandingInvoicesReport(tenantId);
  }

  @Get('outstanding-bills')
  async outstandingBills(@TenantId() tenantId: string) {
    return this.reportsService.outstandingBillsReport(tenantId);
  }

  @Get('expenses')
  async expenses(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.expenseReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('income-expense')
  async incomeExpense(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.incomeVsExpenseReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('insurance')
  async insurance(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.insuranceReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('customer-retention')
  async customerRetention(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.customerRetentionReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('credit-notes')
  async creditNotes(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.creditNotesReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }
}
