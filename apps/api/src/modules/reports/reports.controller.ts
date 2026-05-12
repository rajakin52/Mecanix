import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { StatementsService } from './statements.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
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
@UseGuards(TenantGuard, RolesGuard, CapabilityGuard)
@Roles('owner', 'manager')
@RequiresCapability('reports.view')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly statementsService: StatementsService,
  ) {}

  @Get('statements/customer/:customerId')
  async customerStatement(
    @TenantId() tenantId: string,
    @Param('customerId') customerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statementsService.customerStatement(tenantId, customerId, startDate, endDate);
  }

  @Get('statements/vendor/:vendorId')
  async vendorStatement(
    @TenantId() tenantId: string,
    @Param('vendorId') vendorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statementsService.vendorStatement(tenantId, vendorId, startDate, endDate);
  }

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

  @Get('parts-profitability')
  @UseGuards(TenantGuard)
  async partsProfitability(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.partsItemProfitability(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('estimate-vs-actual')
  @UseGuards(TenantGuard)
  async estimateVsActual(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.estimateVsActual(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('inventory-valuation')
  async inventoryValuation(@TenantId() tenantId: string) {
    return this.reportsService.inventoryValuationReport(tenantId);
  }

  @Get('stock-movements')
  async stockMovements(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.stockMovementsReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('low-stock')
  async lowStock(@TenantId() tenantId: string) {
    return this.reportsService.lowStockReport(tenantId);
  }

  @Get('purchase-request-summary')
  async purchaseRequestSummary(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.purchaseRequestSummaryReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('vendor-performance')
  async vendorPerformance(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.vendorPerformanceReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('wip-inventory')
  async wipInventory(@TenantId() tenantId: string) {
    return this.reportsService.wipInventoryReport(tenantId);
  }

  @Get('kpis')
  async kpis(
    @TenantId() tenantId: string,
    @Query('months') months?: string,
  ) {
    return this.reportsService.kpiDashboard(tenantId, Number(months) || 6);
  }

  @Get('manager-kpis')
  async managerKpis(
    @TenantId() tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.managerKpis(tenantId, branchId || null);
  }

  @Get('vat-summary')
  async vatSummary(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.vatSummaryReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('captive-vat')
  async captiveVat(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.captiveVatReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('service-retention')
  async serviceRetention(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.serviceRetentionReport(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  // ── Parts-purchases reports ───────────────────────────────────

  @Get('parts-purchased')
  async partsPurchased(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.partsPurchased(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }

  @Get('pending-deliveries')
  async pendingDeliveries(@TenantId() tenantId: string) {
    return this.reportsService.pendingDeliveries(tenantId);
  }

  @Get('consumables-stock')
  async consumablesStock(@TenantId() tenantId: string) {
    return this.reportsService.consumablesStock(tenantId);
  }

  @Get('slow-moving')
  async slowMoving(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.slowMovingParts(
      tenantId,
      days ? Number(days) : 180,
    );
  }

  @Get('abc-analysis')
  async abcAnalysis(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaults = getDefaultDateRange();
    return this.reportsService.abcAnalysis(
      tenantId,
      startDate || defaults.startDate,
      endDate || defaults.endDate,
    );
  }
}
