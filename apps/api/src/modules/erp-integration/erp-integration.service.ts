import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ErpProvider, ErpConnectionConfig, ErpInvoiceData, ErpPaymentData } from './erp-provider.interface';
import { PrimaveraV10Provider } from './providers/primavera-v10.provider';
import { SaftExportProvider } from './providers/saft-export.provider';
import { encrypt, decrypt, isEncrypted } from '../../common/utils/encryption';

@Injectable()
export class ErpIntegrationService {
  private readonly logger = new Logger('ErpIntegration');
  private readonly providers: Record<string, ErpProvider> = {
    primavera_v10: new PrimaveraV10Provider(),
    saft_export: new SaftExportProvider(),
  };

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get the ERP connection config for a tenant.
   */
  async getConfig(tenantId: string): Promise<ErpConnectionConfig | null> {
    const { data } = await this.supabase.getClient()
      .from('erp_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) return null;

    // Decrypt password if it was stored encrypted
    let password = data.password as string | null;
    if (password && isEncrypted(password)) {
      try {
        password = decrypt(password);
      } catch (err) {
        this.logger.error('Failed to decrypt ERP password — it may need to be re-saved');
        password = null;
      }
    }

    return {
      provider: data.provider,
      baseUrl: data.base_url,
      companyCode: data.company_code,
      username: data.username,
      password: password ?? undefined,
      instanceName: data.instance_name,
      invoiceSeries: data.invoice_series ?? 'MEC',
      creditNoteSeries: data.credit_note_series ?? 'MEC',
      receiptSeries: data.receipt_series ?? 'MEC',
      taxMapping: data.tax_mapping ?? { standard: 'NOR' },
      baseCurrency: data.base_currency ?? 'AOA',
      defaultLabourArticle: data.default_labour_article ?? 'SRV-MO',
      defaultPartsArticle: data.default_parts_article ?? 'SRV-PC',
    };
  }

  /**
   * Save/update ERP config for a tenant.
   */
  async saveConfig(tenantId: string, userId: string, config: Record<string, unknown>) {
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('erp_connections')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Encrypt the password before storing
    const rawPassword = config.password as string | null | undefined;
    const encryptedPassword = rawPassword ? encrypt(rawPassword) : null;

    const dbData: Record<string, unknown> = {
      tenant_id: tenantId,
      provider: config.provider ?? 'primavera_v10',
      is_active: config.isActive ?? false,
      base_url: config.baseUrl ?? null,
      company_code: config.companyCode ?? null,
      username: config.username ?? null,
      password: encryptedPassword,
      instance_name: config.instanceName ?? 'Default',
      invoice_series: config.invoiceSeries ?? 'MEC',
      credit_note_series: config.creditNoteSeries ?? 'MEC',
      receipt_series: config.receiptSeries ?? 'MEC',
      tax_mapping: config.taxMapping ?? { standard: 'NOR' },
      base_currency: config.baseCurrency ?? 'AOA',
      auto_export_invoices: config.autoExportInvoices ?? false,
      auto_export_payments: config.autoExportPayments ?? false,
      default_labour_article: config.defaultLabourArticle ?? 'SRV-MO',
      default_parts_article: config.defaultPartsArticle ?? 'SRV-PC',
      created_by: userId,
    };

    if (existing) {
      const { data, error } = await client
        .from('erp_connections')
        .update(dbData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await client
        .from('erp_connections')
        .insert(dbData)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  /**
   * Test the ERP connection.
   */
  async testConnection(tenantId: string) {
    const config = await this.getConfig(tenantId);
    if (!config) throw new BadRequestException('No ERP configuration found');

    const provider = this.providers[config.provider];
    if (!provider) throw new BadRequestException(`Unknown provider: ${config.provider}`);

    return provider.testConnection(config);
  }

  /**
   * Export an invoice to the ERP.
   */
  async exportInvoice(tenantId: string, invoiceId: string) {
    const config = await this.getConfig(tenantId);
    if (!config) throw new BadRequestException('No ERP configuration found');

    const provider = this.providers[config.provider];
    if (!provider) throw new BadRequestException(`Unknown provider: ${config.provider}`);

    // Check idempotency
    const { data: existing } = await this.supabase.getClient()
      .from('erp_export_log')
      .select('id, erp_doc_number, status')
      .eq('mecanix_id', invoiceId)
      .eq('document_type', 'invoice')
      .neq('status', 'failed')
      .maybeSingle();

    if (existing?.status === 'exported') {
      return { alreadyExported: true, documentNumber: existing.erp_doc_number };
    }

    // Fetch invoice data from MECANIX
    const invoiceData = await this.fetchInvoiceData(tenantId, invoiceId);

    // Create export log entry
    const { data: logEntry } = await this.supabase.getClient()
      .from('erp_export_log')
      .insert({
        tenant_id: tenantId,
        document_type: 'invoice',
        mecanix_id: invoiceId,
        mecanix_ref: invoiceData.invoiceNumber,
        erp_provider: config.provider,
        status: 'processing',
      })
      .select()
      .single();

    // Export
    const result = await provider.exportInvoice(config, invoiceData);

    // Update log
    await this.supabase.getClient()
      .from('erp_export_log')
      .update({
        status: result.success ? 'exported' : 'failed',
        erp_doc_number: result.documentNumber ?? null,
        erp_doc_id: result.documentId ?? null,
        error_message: result.errors?.join('; ') ?? null,
        processed_at: new Date().toISOString(),
        exported_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', logEntry!.id);

    return result;
  }

  /**
   * Get export log with status.
   */
  async getExportLog(tenantId: string, status?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('erp_export_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Retry a failed export.
   */
  async retryExport(tenantId: string, exportLogId: string) {
    const { data: logEntry } = await this.supabase.getClient()
      .from('erp_export_log')
      .select('*')
      .eq('id', exportLogId)
      .eq('tenant_id', tenantId)
      .single();

    if (!logEntry) throw new NotFoundException('Export log entry not found');
    if (logEntry.status !== 'failed') throw new BadRequestException('Only failed exports can be retried');

    // Delete the failed entry and re-export
    await this.supabase.getClient()
      .from('erp_export_log')
      .delete()
      .eq('id', exportLogId);

    if (logEntry.document_type === 'invoice') {
      return this.exportInvoice(tenantId, logEntry.mecanix_id);
    }

    throw new BadRequestException(`Retry not supported for ${logEntry.document_type}`);
  }

  private async fetchInvoiceData(tenantId: string, invoiceId: string): Promise<ErpInvoiceData> {
    const client = this.supabase.getClient();

    const { data: invoice } = await client
      .from('invoices')
      .select('*, customer:customers(full_name, phone, tax_id), job_card:job_cards(job_number)')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (!invoice) throw new NotFoundException('Invoice not found');

    // Fetch line items
    const { data: lines } = await client
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });

    return {
      mecanixId: invoice.id,
      invoiceNumber: invoice.invoice_number ?? invoiceId.slice(0, 8),
      date: (invoice.issue_date ?? invoice.created_at).slice(0, 10),
      dueDate: invoice.due_date?.slice(0, 10),
      customerName: invoice.customer?.full_name ?? 'Unknown',
      customerTaxId: invoice.customer?.tax_id,
      customerPhone: invoice.customer?.phone,
      currency: invoice.currency ?? 'AOA',
      lines: (lines ?? []).map((line: Record<string, unknown>) => ({
        description: (line.description as string) ?? '',
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unit_price) || 0,
        taxCode: 'standard',
        taxRate: Number(line.tax_rate) || 14,
        lineType: (line.line_type as 'labour' | 'parts') ?? 'labour',
      })),
      labourTotal: Number(invoice.labour_total) || 0,
      partsTotal: Number(invoice.parts_total) || 0,
      taxAmount: Number(invoice.tax_amount) || 0,
      grandTotal: Number(invoice.total) || 0,
    };
  }
}
