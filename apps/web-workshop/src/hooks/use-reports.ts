'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildParams(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return params.toString() ? `?${params}` : '';
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
