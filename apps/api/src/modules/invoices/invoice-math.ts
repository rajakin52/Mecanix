/**
 * Pure invoice-math engine for Angola VAT + Cativo + service retention.
 *
 * VAT model summary (relevant to the Angolan regime):
 *  - Each line carries a snapshot of the tax rate that applied when it was booked.
 *  - VAT is accumulated per-rate so the final invoice can show the breakdown
 *    (14%, 7%, 5%, 0%).
 *  - Cativo ("captive VAT"): some customer classes (banks, insurers, state)
 *    withhold a fraction of the VAT (50% or 100%) and remit it directly to AGT.
 *  - Service retention ("Retenção na Fonte / Imposto Industrial"): 6.5% of the
 *    labour total, withheld by the customer against their income-tax liability.
 *  - Insurance jobs: an explicit customer_portion split is honoured; otherwise
 *    the full net-of-withholdings amount is billed to the customer.
 *  - Discounts: invoice-global discount (pct + amount, additive) applied
 *    pre-VAT and distributed proportionally across each line's VAT band, so
 *    vat_by_rate stays correct on the post-discount base.
 */

export interface InvoiceLine {
  subtotal: number;
  tax_rate: number | null;
}

export interface InvoiceMathInput {
  labourLines: InvoiceLine[];
  partsLines: InvoiceLine[];
  customerCaptivePct: number; // 0, 50, 100
  customerRetains: boolean;
  isTaxable: boolean;
  isInsurance: boolean;
  customerPortionOverride?: number | null;
  // Invoice-global discount applied to lines total BEFORE VAT.
  // Distributed proportionally so vat_by_rate stays correct per band.
  invoiceDiscountPct?: number;
  invoiceDiscountAmount?: number;
}

export interface InvoiceMathResult {
  labourTotal: number;       // gross — pre-line-discount values caller already passed in
  partsTotal: number;
  grossLinesTotal: number;   // labour + parts before any invoice-global discount
  invoiceDiscount: number;   // currency amount of invoice-global discount actually applied
  subtotal: number;          // lines total post invoice-global discount
  vatByRate: Record<string, number>;
  totalVat: number;
  captiveAmount: number;
  retentionPct: number;
  retentionAmount: number;
  grandTotal: number;
  clientOwes: number;
  customerPortion: number;
  insurancePortion: number;
  legacyTaxRate: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeInvoiceTotals(input: InvoiceMathInput): InvoiceMathResult {
  const labourTotal = input.labourLines.reduce((s, l) => s + (l.subtotal || 0), 0);
  const partsTotal = input.partsLines.reduce((s, p) => s + (p.subtotal || 0), 0);
  const grossLinesTotal = labourTotal + partsTotal;

  // Resolve invoice-global discount. pct and amount are additive
  // (pct first, then amount). Clamped at the gross lines total so
  // the post-discount subtotal can't go negative.
  const invDiscPct = Number(input.invoiceDiscountPct ?? 0);
  const invDiscAmt = Number(input.invoiceDiscountAmount ?? 0);
  const rawInvoiceDiscount = (grossLinesTotal * invDiscPct) / 100 + invDiscAmt;
  const invoiceDiscount = Math.min(rawInvoiceDiscount, grossLinesTotal);

  // Discount factor applied to each line's subtotal when computing VAT.
  // Must be applied pre-VAT so AGT-correct VAT by band reflects the
  // discounted base.
  const discountFactor = grossLinesTotal > 0
    ? 1 - invoiceDiscount / grossLinesTotal
    : 1;

  const vatByRate: Record<string, number> = {};
  const addVat = (subtotal: number, rate: number | null | undefined) => {
    if (!input.isTaxable) return;
    const r = Number(rate ?? 0);
    const vat = subtotal * discountFactor * (r / 100);
    const key = r.toFixed(2);
    vatByRate[key] = (vatByRate[key] ?? 0) + vat;
  };
  input.labourLines.forEach((l) => addVat(l.subtotal || 0, l.tax_rate));
  input.partsLines.forEach((p) => addVat(p.subtotal || 0, p.tax_rate));

  const totalVat = Object.values(vatByRate).reduce((s, v) => s + v, 0);

  const captiveAmount = totalVat * (input.customerCaptivePct / 100);

  // Retention base also follows the discount factor — withholding is on
  // the actual labour billed, not the gross before discount.
  const retentionPct = input.customerRetains ? 6.5 : 0;
  const retentionAmount = labourTotal * discountFactor * (retentionPct / 100);

  const subtotal = grossLinesTotal - invoiceDiscount;
  const grandTotal = subtotal + totalVat;
  const clientOwes = grandTotal - captiveAmount - retentionAmount;

  // Round vat_by_rate values
  const vatByRateRounded: Record<string, number> = {};
  for (const [k, v] of Object.entries(vatByRate)) vatByRateRounded[k] = round2(v);

  let customerPortion = round2(clientOwes);
  let insurancePortion = 0;
  if (input.isInsurance) {
    customerPortion = input.customerPortionOverride != null
      ? round2(input.customerPortionOverride)
      : round2(clientOwes);
    insurancePortion = round2(clientOwes - customerPortion);
  }

  const legacyKey = Object.entries(vatByRate).sort(([, a], [, b]) => b - a)[0]?.[0];

  return {
    labourTotal: round2(labourTotal),
    partsTotal: round2(partsTotal),
    grossLinesTotal: round2(grossLinesTotal),
    invoiceDiscount: round2(invoiceDiscount),
    subtotal: round2(subtotal),
    vatByRate: vatByRateRounded,
    totalVat: round2(totalVat),
    captiveAmount: round2(captiveAmount),
    retentionPct,
    retentionAmount: round2(retentionAmount),
    grandTotal: round2(grandTotal),
    clientOwes: round2(clientOwes),
    customerPortion,
    insurancePortion,
    legacyTaxRate: legacyKey ? Number(legacyKey) : 0,
  };
}
