'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildParams(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return params.toString() ? `?${params}` : '';
}

export interface StatementTxn {
  date: string;
  type: 'invoice' | 'payment' | 'credit_note' | 'bill' | 'bill_payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  due_date?: string | null;
  balance_due?: number | null;
  days_overdue?: number | null;
  aging_bucket?: 'current' | '30' | '60' | '90+' | null;
  status?: string | null;
}
export interface AgingBuckets {
  current: number; thirty: number; sixty: number; ninety: number; total: number;
}
export interface CustomerStatement {
  entity: { id: string; full_name: string; phone?: string; email?: string; company_name?: string; current_balance?: number };
  openingBalance: number;
  transactions: StatementTxn[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  aging?: AgingBuckets;
}

export function useCustomerStatement(customerId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-customer-statement', customerId, startDate, endDate],
    queryFn: () => api.get<CustomerStatement>(`/reports/statements/customer/${customerId}${buildParams(startDate, endDate)}`),
    enabled: !!customerId,
  });
}

export interface CustomerBalanceRow {
  customer_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  open_invoices: number;
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  total_outstanding: number;
}

export function useCustomerBalances() {
  return useQuery({
    queryKey: ['report-customer-balances'],
    queryFn: () => api.get<CustomerBalanceRow[]>('/reports/statements/customer-balances'),
  });
}

export type AgingBucket = 'current' | '30' | '60' | '90' | '90+';

export interface AgingReceivableRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  days_overdue: number;
  bucket: AgingBucket;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
}

export interface AgingTotals {
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  ninetyPlus: number;
  total: number;
  invoice_count: number;
}

export interface AgingCustomerGroup {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  invoices: AgingReceivableRow[];
  totals: AgingTotals;
}

export interface AgingReceivablesReport {
  as_of_date: string;
  customers: AgingCustomerGroup[];
  totals: AgingTotals;
}

export function useAgingReceivables(customerId?: string, asOfDate?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  if (asOfDate) params.set('asOfDate', asOfDate);
  const qs = params.toString();
  return useQuery({
    queryKey: ['report-aging-receivables', customerId ?? null, asOfDate ?? null],
    queryFn: () =>
      api.get<AgingReceivablesReport>(
        `/reports/statements/aging-receivables${qs ? `?${qs}` : ''}`,
      ),
  });
}

export function useRevenueReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-revenue', startDate, endDate],
    queryFn: () => api.get<Record<string, number>>(`/reports/revenue${buildParams(startDate, endDate)}`),
  });
}

export function useJobCardReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-jobs', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/jobs${buildParams(startDate, endDate)}`),
  });
}

export function useTechnicianReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-technicians', startDate, endDate],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/reports/technicians${buildParams(startDate, endDate)}`),
  });
}

export function usePartsUsageReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-parts', startDate, endDate],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/reports/parts-usage${buildParams(startDate, endDate)}`),
  });
}

export function useOutstandingInvoices() {
  return useQuery({
    queryKey: ['report-outstanding-invoices'],
    queryFn: () => api.get<Record<string, unknown>>('/reports/outstanding-invoices'),
  });
}

export function useKpiDashboard(months = 6) {
  return useQuery({
    queryKey: ['report-kpis', months],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/kpis?months=${months}`),
  });
}

export interface ManagerKpis {
  bay_utilization: { busy: number; total: number; pct: number };
  first_time_right_pct: number;
  comeback_pct: number;
  retention: {
    m6: { active: number; repeat: number };
    m12: { active: number; repeat: number };
    m24: { active: number; repeat: number };
  };
}

export function useManagerKpis(branchId?: string | null) {
  return useQuery<ManagerKpis>({
    queryKey: ['report-manager-kpis', branchId ?? null],
    queryFn: () =>
      api.get<ManagerKpis>(
        `/reports/manager-kpis${branchId ? `?branchId=${branchId}` : ''}`,
      ),
    refetchInterval: 60_000,
  });
}

export function useOutstandingBills() {
  return useQuery({
    queryKey: ['report-outstanding-bills'],
    queryFn: () => api.get<Record<string, unknown>>('/reports/outstanding-bills'),
  });
}

export function useExpenseReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-expenses', startDate, endDate],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/reports/expenses${buildParams(startDate, endDate)}`),
  });
}

export function useIncomeExpenseReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-income-expense', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/income-expense${buildParams(startDate, endDate)}`),
  });
}

export function useInsuranceReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-insurance', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/insurance${buildParams(startDate, endDate)}`),
  });
}

export function useCustomerRetentionReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-retention', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/customer-retention${buildParams(startDate, endDate)}`),
  });
}

export function usePartsProfitabilityReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-parts-profitability', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/parts-profitability${buildParams(startDate, endDate)}`),
  });
}

export function useEstimateVsActualReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-estimate-vs-actual', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/estimate-vs-actual${buildParams(startDate, endDate)}`),
  });
}

export function useInventoryValuationReport() {
  return useQuery({
    queryKey: ['report-inventory-valuation'],
    queryFn: () => api.get<Record<string, unknown>>('/reports/inventory-valuation'),
  });
}

export interface InventoryValuationByMethodRow {
  part_id: string;
  part_number: string | null;
  description: string;
  category: string;
  cost_method: string | null;
  stock_qty: number;
  last_cost: number;
  last_cost_value: number;
  wac: number;
  wac_value: number;
  fifo_next_cost: number;
  lifo_next_cost: number;
  highest_cost: number;
  highest_cost_value: number;
  layer_value: number;
  layer_count: number;
}

export interface InventoryValuationByMethodResponse {
  rows: InventoryValuationByMethodRow[];
  totals: {
    totalUnits: number;
    lastCostValue: number;
    wacValue: number;
    layerValue: number;
    highestCostValue: number;
  };
}

export function useInventoryValuationByMethodReport() {
  return useQuery({
    queryKey: ['report-inventory-valuation-by-method'],
    queryFn: () =>
      api.get<InventoryValuationByMethodResponse>('/reports/inventory-valuation-by-method'),
  });
}

export function useStockMovementsReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-stock-movements', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/stock-movements${buildParams(startDate, endDate)}`),
  });
}

export function useLowStockReport() {
  return useQuery({
    queryKey: ['report-low-stock'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/reports/low-stock'),
  });
}

export function usePurchaseRequestSummaryReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-purchase-request-summary', startDate, endDate],
    queryFn: () => api.get<Record<string, unknown>>(`/reports/purchase-request-summary${buildParams(startDate, endDate)}`),
  });
}

export function useVendorPerformanceReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-vendor-performance', startDate, endDate],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/reports/vendor-performance${buildParams(startDate, endDate)}`),
  });
}

export interface PartsMarginByCostMethodRow {
  cost_method: string;
  line_count: number;
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number;
}

export function usePartsMarginByCostMethod(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-parts-margin-by-cost-method', startDate, endDate],
    queryFn: () =>
      api.get<PartsMarginByCostMethodRow[]>(
        `/reports/parts-margin-by-cost-method${buildParams(startDate, endDate)}`,
      ),
  });
}

export function useWipInventoryReport() {
  return useQuery({
    queryKey: ['report-wip-inventory'],
    queryFn: () => api.get<Record<string, unknown>>('/reports/wip-inventory'),
  });
}
