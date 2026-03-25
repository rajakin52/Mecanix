/**
 * Abstract ERP Provider Interface.
 * Implementations: Primavera V10, Primavera Jasmin, SAF-T Export.
 */
export interface ErpDocumentResult {
  success: boolean;
  documentNumber?: string;   // ERP-assigned (e.g., "FT MEC/2026/00001")
  documentId?: string;       // ERP internal ID
  errors?: string[];
  warnings?: string[];
}

export interface ErpConnectionConfig {
  provider: string;
  baseUrl?: string;
  companyCode?: string;
  username?: string;
  password?: string;
  instanceName?: string;
  invoiceSeries: string;
  creditNoteSeries: string;
  receiptSeries: string;
  taxMapping: Record<string, string>;
  baseCurrency: string;
  defaultLabourArticle: string;
  defaultPartsArticle: string;
}

export interface ErpInvoiceData {
  mecanixId: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  customerCode?: string;
  customerName: string;
  customerTaxId?: string;
  customerPhone?: string;
  currency: string;
  exchangeRate?: number;
  lines: ErpDocumentLine[];
  labourTotal: number;
  partsTotal: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string;
}

export interface ErpDocumentLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxCode: string;
  taxRate: number;
  lineType: 'labour' | 'parts';
  articleCode?: string;
}

export interface ErpPaymentData {
  mecanixId: string;
  invoiceDocNumber: string;  // Primavera invoice to settle against
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  currency: string;
}

export interface ErpProvider {
  readonly name: string;

  /** Test the connection */
  testConnection(config: ErpConnectionConfig): Promise<{ connected: boolean; error?: string }>;

  /** Export an invoice (FT) */
  exportInvoice(config: ErpConnectionConfig, data: ErpInvoiceData): Promise<ErpDocumentResult>;

  /** Export a credit note (NC) */
  exportCreditNote(config: ErpConnectionConfig, data: ErpInvoiceData, originalDocNumber: string): Promise<ErpDocumentResult>;

  /** Export a payment receipt (RE) */
  exportPayment(config: ErpConnectionConfig, data: ErpPaymentData): Promise<ErpDocumentResult>;
}
