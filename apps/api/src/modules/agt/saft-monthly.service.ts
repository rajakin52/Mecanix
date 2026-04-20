import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Escapes XML-special characters. Keep minimal — SAF-T values are
 * short strings; no CDATA needed for the fields we emit.
 */
function xml(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function num(n: number | string | null | undefined, dp = 2): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toFixed(dp) : (0).toFixed(dp);
}

@Injectable()
export class SaftMonthlyService {
  private readonly logger = new Logger(SaftMonthlyService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Build a SAF-T AO monthly XML string for the given period.
   *
   * Scope is intentionally *scaffolded* — this is a compliance-
   * readable file covering Header + MasterFiles.Customer +
   * SourceDocuments.SalesInvoices + sales totals. It's a starting
   * point a contador can open in Excel or the AGT validator, not
   * a byte-for-byte certified export. Full certification (SAFT-T
   * 1.04 AO schema + digital signatures on every InvoiceNumber)
   * comes when the tenant opts into AGT auto-submission.
   */
  async buildMonthlyXml(tenantId: string, year: number, month: number) {
    const client = this.supabase.getClient();

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);

    const { data: tenant } = await client
      .from('tenants')
      .select('name, tax_id, address, currency')
      .eq('id', tenantId)
      .single();

    // Invoices in period (only issued ones — draft/cancelled excluded).
    const { data: invoices } = await client
      .from('invoices')
      .select(
        'id, invoice_number, invoice_date, due_date, grand_total, tax_amount, subtotal, paid_amount, balance_due, status, saft_document_number, saft_hash, customer:customers(id, full_name, tax_id, phone, email, address)',
      )
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("draft","cancelled")')
      .gte('invoice_date', periodStart)
      .lte('invoice_date', periodEnd)
      .order('invoice_date', { ascending: true });

    const invs = invoices ?? [];

    // Dedupe customers for MasterFiles
    const customers = new Map<string, Record<string, unknown>>();
    for (const inv of invs) {
      const c = inv.customer as unknown as Record<string, unknown> | null;
      if (c && c.id) customers.set(c.id as string, c);
    }

    const totalRevenue = invs.reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
    const totalTax = invs.reduce((s, i) => s + (Number(i.tax_amount) || 0), 0);

    const companyName = xml((tenant?.name as string) ?? 'Unknown');
    const companyTaxId = xml((tenant?.tax_id as string) ?? '');
    const companyAddress = xml((tenant?.address as string) ?? '');
    const currency = (tenant?.currency as string) ?? 'AOA';

    const customerXml = Array.from(customers.values())
      .map((c) => {
        return `    <Customer>
      <CustomerID>${xml(c.id)}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${xml(c.tax_id ?? '999999990')}</CustomerTaxID>
      <CompanyName>${xml(c.full_name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${xml(c.address ?? 'Desconhecido')}</AddressDetail>
        <City>Desconhecido</City>
        <Country>AO</Country>
      </BillingAddress>
      <Telephone>${xml(c.phone ?? '')}</Telephone>
      <Email>${xml(c.email ?? '')}</Email>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`;
      })
      .join('\n');

    const invoicesXml = invs
      .map((inv) => {
        const c = inv.customer as unknown as Record<string, unknown> | null;
        const docNumber = (inv.saft_document_number as string) ?? xml(inv.invoice_number);
        return `      <Invoice>
        <InvoiceNo>${xml(docNumber)}</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${xml(inv.invoice_date)}</InvoiceStatusDate>
          <SourceID>Mecanix</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${xml(inv.saft_hash ?? '0')}</Hash>
        <Period>${month}</Period>
        <InvoiceDate>${xml(inv.invoice_date)}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>Mecanix</SourceID>
        <SystemEntryDate>${xml(inv.invoice_date)}T00:00:00</SystemEntryDate>
        <CustomerID>${xml(c?.id ?? 'UNKNOWN')}</CustomerID>
        <DocumentTotals>
          <TaxPayable>${num(inv.tax_amount)}</TaxPayable>
          <NetTotal>${num(inv.subtotal)}</NetTotal>
          <GrossTotal>${num(inv.grand_total)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
      })
      .join('\n');

    const nowIso = new Date().toISOString();

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${companyTaxId}</CompanyID>
    <TaxRegistrationNumber>${companyTaxId}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${companyName}</CompanyName>
    <BusinessName>${companyName}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${companyAddress}</AddressDetail>
      <City>Luanda</City>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${year}</FiscalYear>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
    <CurrencyCode>${currency}</CurrencyCode>
    <DateCreated>${nowIso.slice(0, 10)}</DateCreated>
    <TaxEntity>Sede</TaxEntity>
    <ProductCompanyTaxID>${companyTaxId}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>Mecanix/Mecanix</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
${customerXml || '    <!-- no customers in period -->'}
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${invs.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${num(totalRevenue)}</TotalCredit>
${invoicesXml || '      <!-- no invoices in period -->'}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

    return {
      xml: xmlBody,
      periodStart,
      periodEnd,
      invoiceCount: invs.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
    };
  }

  /**
   * Generate and persist the monthly SAF-T for a tenant. Uploads
   * the XML to Supabase Storage bucket `saft-exports`, records a
   * row in saft_exports, and returns the downloadable URL.
   */
  async generateMonthly(tenantId: string, userId: string, year: number, month: number) {
    const client = this.supabase.getClient();

    const { xml: body, periodStart, periodEnd, invoiceCount, totalRevenue, totalTax } =
      await this.buildMonthlyXml(tenantId, year, month);

    const filename = `${tenantId}/${year}/${String(month).padStart(2, '0')}-saft-ao.xml`;
    const buffer = Buffer.from(body, 'utf-8');

    const { error: upErr } = await client.storage
      .from('saft-exports')
      .upload(filename, buffer, {
        contentType: 'application/xml',
        upsert: true,
      });

    if (upErr) {
      // If bucket doesn't exist yet, fail loud — operator creates it once.
      throw new Error(
        `Failed to upload SAF-T to storage: ${upErr.message}. Ensure bucket 'saft-exports' exists.`,
      );
    }

    const { data: urlData } = client.storage.from('saft-exports').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;

    // Upsert history row (period is unique so re-generating same
    // month replaces the previous record rather than duplicating).
    const { data: row, error: dbErr } = await client
      .from('saft_exports')
      .upsert(
        {
          tenant_id: tenantId,
          period_year: year,
          period_month: month,
          period_start: periodStart,
          period_end: periodEnd,
          storage_path: filename,
          public_url: publicUrl,
          file_size: buffer.length,
          invoice_count: invoiceCount,
          total_revenue: totalRevenue,
          total_tax: totalTax,
          generated_at: new Date().toISOString(),
          generated_by: userId,
          error_message: null,
        },
        { onConflict: 'tenant_id,period_year,period_month' },
      )
      .select()
      .single();

    if (dbErr) throw dbErr;
    return row;
  }

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('saft_exports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
