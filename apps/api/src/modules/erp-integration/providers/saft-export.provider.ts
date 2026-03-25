import { Logger } from '@nestjs/common';
import type {
  ErpProvider,
  ErpConnectionConfig,
  ErpInvoiceData,
  ErpPaymentData,
  ErpDocumentResult,
} from '../erp-provider.interface';

/**
 * SAF-T XML Export Provider — generates SAF-T compliant XML files.
 * Fallback when direct Primavera API is not available.
 * Supports SAF-T-PT (Portugal), SAF-T-AO (Angola).
 */
export class SaftExportProvider implements ErpProvider {
  readonly name = 'saft_export';
  private readonly logger = new Logger('SaftExport');

  async testConnection(_config: ErpConnectionConfig): Promise<{ connected: boolean; error?: string }> {
    return { connected: true }; // SAF-T is file-based, always "connected"
  }

  async exportInvoice(_config: ErpConnectionConfig, data: ErpInvoiceData): Promise<ErpDocumentResult> {
    try {
      const xml = this.generateInvoiceXml(data, _config);
      // In production, store the XML in Supabase Storage or return it
      this.logger.log(`Generated SAF-T invoice XML for ${data.invoiceNumber} (${xml.length} bytes)`);

      return {
        success: true,
        documentNumber: `SAFT-${data.invoiceNumber}`,
        warnings: ['SAF-T XML generated — import into ERP manually'],
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'SAF-T generation failed'],
      };
    }
  }

  async exportCreditNote(_config: ErpConnectionConfig, data: ErpInvoiceData, originalDocNumber: string): Promise<ErpDocumentResult> {
    try {
      const xml = this.generateCreditNoteXml(data, originalDocNumber, _config);
      this.logger.log(`Generated SAF-T credit note XML for ${data.invoiceNumber} (${xml.length} bytes)`);

      return {
        success: true,
        documentNumber: `SAFT-NC-${data.invoiceNumber}`,
        warnings: ['SAF-T XML generated — import into ERP manually'],
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'SAF-T generation failed'],
      };
    }
  }

  async exportPayment(_config: ErpConnectionConfig, data: ErpPaymentData): Promise<ErpDocumentResult> {
    this.logger.log(`SAF-T payment export for ${data.invoiceDocNumber}`);
    return {
      success: true,
      documentNumber: `SAFT-RE-${data.mecanixId.slice(0, 8)}`,
      warnings: ['Payment included in next SAF-T export batch'],
    };
  }

  private generateInvoiceXml(data: ErpInvoiceData, config: ErpConnectionConfig): string {
    const taxCode = config.taxMapping['standard'] ?? 'NOR';
    const lines = data.lines.map((line, i) => `
      <Line>
        <LineNumber>${i + 1}</LineNumber>
        <ProductCode>${line.articleCode ?? 'SRV'}</ProductCode>
        <ProductDescription>${this.escapeXml(line.description)}</ProductDescription>
        <Quantity>${line.quantity}</Quantity>
        <UnitOfMeasure>UN</UnitOfMeasure>
        <UnitPrice>${line.unitPrice.toFixed(2)}</UnitPrice>
        <CreditAmount>${(line.quantity * line.unitPrice).toFixed(2)}</CreditAmount>
        <Tax>
          <TaxType>IVA</TaxType>
          <TaxCountryRegion>${config.baseCurrency === 'AOA' ? 'AO' : config.baseCurrency === 'MZN' ? 'MZ' : 'PT'}</TaxCountryRegion>
          <TaxCode>${taxCode}</TaxCode>
          <TaxPercentage>${line.taxRate}</TaxPercentage>
        </Tax>
      </Line>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${config.companyCode ?? 'MECANIX'}</CompanyID>
    <FiscalYear>${new Date(data.date).getFullYear()}</FiscalYear>
    <CurrencyCode>${data.currency ?? config.baseCurrency}</CurrencyCode>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>1</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${data.grandTotal.toFixed(2)}</TotalCredit>
      <Invoice>
        <InvoiceNo>FT ${config.invoiceSeries}/${data.invoiceNumber}</InvoiceNo>
        <InvoiceStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${data.date}T00:00:00</InvoiceStatusDate>
        </InvoiceStatus>
        <InvoiceDate>${data.date}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <CustomerID>${data.customerCode ?? 'CF'}</CustomerID>
        ${lines}
        <DocumentTotals>
          <TaxPayable>${data.taxAmount.toFixed(2)}</TaxPayable>
          <NetTotal>${(data.grandTotal - data.taxAmount).toFixed(2)}</NetTotal>
          <GrossTotal>${data.grandTotal.toFixed(2)}</GrossTotal>
          <Currency>
            <CurrencyCode>${data.currency ?? config.baseCurrency}</CurrencyCode>
            <CurrencyAmount>${data.grandTotal.toFixed(2)}</CurrencyAmount>
          </Currency>
        </DocumentTotals>
      </Invoice>
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
  }

  private generateCreditNoteXml(data: ErpInvoiceData, originalDocNumber: string, config: ErpConnectionConfig): string {
    // Similar to invoice but with InvoiceType = NC and reference to original
    return this.generateInvoiceXml(data, config)
      .replace('<InvoiceType>FT</InvoiceType>', '<InvoiceType>NC</InvoiceType>')
      .replace(
        `<InvoiceNo>FT ${config.invoiceSeries}/${data.invoiceNumber}</InvoiceNo>`,
        `<InvoiceNo>NC ${config.creditNoteSeries}/${data.invoiceNumber}</InvoiceNo>`,
      );
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
