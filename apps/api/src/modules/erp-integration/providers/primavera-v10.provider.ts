import { Logger } from '@nestjs/common';
import type {
  ErpProvider,
  ErpConnectionConfig,
  ErpInvoiceData,
  ErpPaymentData,
  ErpDocumentResult,
} from '../erp-provider.interface';

/**
 * Primavera V10 Provider — connects via TLBS Web API (REST layer).
 *
 * Primavera V10 on-premise exposes a TLBS (Thin Layer Business Services)
 * HTTP endpoint that wraps the COM engine. Partner access required for
 * full API documentation.
 */
export class PrimaveraV10Provider implements ErpProvider {
  readonly name = 'primavera_v10';
  private readonly logger = new Logger('PrimaveraV10');

  private async apiCall(
    config: ErpConnectionConfig,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${config.baseUrl}${path}`;

    // Authenticate — get session token
    const authRes = await fetch(`${config.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: config.companyCode,
        username: config.username,
        password: config.password,
        instance: config.instanceName ?? 'Default',
      }),
    });

    if (!authRes.ok) {
      throw new Error(`Primavera auth failed: ${authRes.status}`);
    }

    const { token } = (await authRes.json()) as { token: string };

    // Make the actual call
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Primavera API error ${res.status}: ${errorText}`);
    }

    return res.json();
  }

  async testConnection(config: ErpConnectionConfig): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.apiCall(config, 'GET', '/api/v1/system/info');
      return { connected: true };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async exportInvoice(config: ErpConnectionConfig, data: ErpInvoiceData): Promise<ErpDocumentResult> {
    try {
      const primaveraDoc = {
        documentType: 'FT',
        series: config.invoiceSeries,
        entity: data.customerCode ?? data.customerName,
        entityType: 'C',
        documentDate: data.date,
        currency: data.currency ?? config.baseCurrency,
        exchangeRate: data.exchangeRate ?? 1,
        observations: data.notes ?? `MECANIX Invoice ${data.invoiceNumber}`,
        customFields: {
          CDU_MecanixId: data.mecanixId,
          CDU_MecanixRef: data.invoiceNumber,
        },
        lines: data.lines.map((line) => ({
          article: line.articleCode ??
            (line.lineType === 'labour' ? config.defaultLabourArticle : config.defaultPartsArticle),
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unit: 'UN',
          taxCode: config.taxMapping[line.taxCode] ?? config.taxMapping['standard'] ?? 'NOR',
          taxRate: line.taxRate,
        })),
      };

      const result = await this.apiCall(
        config,
        'POST',
        '/api/v1/sales/documents',
        primaveraDoc,
      ) as { docNumber?: string; docId?: string; warnings?: string[] };

      this.logger.log(`Exported invoice ${data.invoiceNumber} → ${result.docNumber}`);

      return {
        success: true,
        documentNumber: result.docNumber,
        documentId: result.docId,
        warnings: result.warnings,
      };
    } catch (err) {
      this.logger.error(`Invoice export failed: ${err}`);
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Export failed'],
      };
    }
  }

  async exportCreditNote(
    config: ErpConnectionConfig,
    data: ErpInvoiceData,
    originalDocNumber: string,
  ): Promise<ErpDocumentResult> {
    try {
      const primaveraDoc = {
        documentType: 'NC',
        series: config.creditNoteSeries,
        entity: data.customerCode ?? data.customerName,
        entityType: 'C',
        documentDate: data.date,
        currency: data.currency ?? config.baseCurrency,
        observations: `Credit note for ${originalDocNumber}. MECANIX ref: ${data.invoiceNumber}`,
        originDocument: {
          type: 'FT',
          number: originalDocNumber,
        },
        customFields: {
          CDU_MecanixId: data.mecanixId,
          CDU_MecanixRef: data.invoiceNumber,
        },
        lines: data.lines.map((line) => ({
          article: line.articleCode ??
            (line.lineType === 'labour' ? config.defaultLabourArticle : config.defaultPartsArticle),
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unit: 'UN',
          taxCode: config.taxMapping[line.taxCode] ?? 'NOR',
          taxRate: line.taxRate,
        })),
      };

      const result = await this.apiCall(
        config,
        'POST',
        '/api/v1/sales/documents',
        primaveraDoc,
      ) as { docNumber?: string; docId?: string };

      return {
        success: true,
        documentNumber: result.docNumber,
        documentId: result.docId,
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Export failed'],
      };
    }
  }

  async exportPayment(config: ErpConnectionConfig, data: ErpPaymentData): Promise<ErpDocumentResult> {
    try {
      const primaveraDoc = {
        documentType: 'RE',
        series: config.receiptSeries,
        documentDate: data.paymentDate,
        currency: data.currency ?? config.baseCurrency,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        settlesDocuments: [
          { documentNumber: data.invoiceDocNumber, amount: data.amount },
        ],
        observations: data.reference ?? `Payment via ${data.paymentMethod}`,
        customFields: {
          CDU_MecanixId: data.mecanixId,
        },
      };

      const result = await this.apiCall(
        config,
        'POST',
        '/api/v1/receivables/receipts',
        primaveraDoc,
      ) as { docNumber?: string; docId?: string };

      return {
        success: true,
        documentNumber: result.docNumber,
        documentId: result.docId,
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Export failed'],
      };
    }
  }
}
