import { describe, it, expect } from 'vitest';
import { computeInvoiceTotals } from './invoice-math';

describe('computeInvoiceTotals', () => {
  const baseInput = {
    customerCaptivePct: 0,
    customerRetains: false,
    isTaxable: true,
    isInsurance: false,
  };

  it('sums labour + parts at single 14% rate', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
    });
    expect(r.labourTotal).toBe(1000);
    expect(r.partsTotal).toBe(500);
    expect(r.subtotal).toBe(1500);
    expect(r.totalVat).toBe(210); // 1500 * 14%
    expect(r.grandTotal).toBe(1710);
    expect(r.clientOwes).toBe(1710);
    expect(r.vatByRate).toEqual({ '14.00': 210 });
    expect(r.legacyTaxRate).toBe(14);
  });

  it('accumulates VAT by rate when lines mix 14/7/5', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      labourLines: [
        { subtotal: 1000, tax_rate: 14 },
        { subtotal: 500, tax_rate: 7 },
      ],
      partsLines: [{ subtotal: 200, tax_rate: 5 }],
    });
    expect(r.vatByRate['14.00']).toBe(140);
    expect(r.vatByRate['7.00']).toBe(35);
    expect(r.vatByRate['5.00']).toBe(10);
    expect(r.totalVat).toBe(185);
    expect(r.legacyTaxRate).toBe(14); // dominant rate
  });

  it('skips VAT entirely when line is not taxable', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      isTaxable: false,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
    });
    expect(r.totalVat).toBe(0);
    expect(r.vatByRate).toEqual({});
    expect(r.grandTotal).toBe(1500);
    expect(r.legacyTaxRate).toBe(0);
  });

  it('applies 50% cativo — half the VAT withheld from the invoice', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      customerCaptivePct: 50,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [],
    });
    expect(r.totalVat).toBe(140);
    expect(r.captiveAmount).toBe(70);
    expect(r.grandTotal).toBe(1140);
    expect(r.clientOwes).toBe(1070); // grand_total - captive
  });

  it('applies 100% cativo — all VAT withheld', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      customerCaptivePct: 100,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
    });
    expect(r.totalVat).toBe(210);
    expect(r.captiveAmount).toBe(210);
    expect(r.grandTotal).toBe(1710);
    expect(r.clientOwes).toBe(1500); // net of all VAT
  });

  it('applies 6.5% service retention on labour only (not parts)', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      customerRetains: true,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
    });
    expect(r.retentionPct).toBe(6.5);
    expect(r.retentionAmount).toBe(65); // 6.5% of 1000 labour, not parts
    expect(r.grandTotal).toBe(1710);
    expect(r.clientOwes).toBe(1645); // 1710 - 65
  });

  it('combines cativo + retention correctly', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      customerCaptivePct: 50,
      customerRetains: true,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
    });
    // totals: labour=1000, parts=500, vat=210, grand=1710
    // captive = 50% * 210 = 105
    // retention = 6.5% * 1000 = 65
    // client owes = 1710 - 105 - 65 = 1540
    expect(r.totalVat).toBe(210);
    expect(r.captiveAmount).toBe(105);
    expect(r.retentionAmount).toBe(65);
    expect(r.clientOwes).toBe(1540);
  });

  it('splits insurance portion when override provided', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      isInsurance: true,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [{ subtotal: 500, tax_rate: 14 }],
      customerPortionOverride: 100, // customer pays 100 of excess
    });
    // clientOwes = 1710
    // customer = 100, insurance = 1610
    expect(r.customerPortion).toBe(100);
    expect(r.insurancePortion).toBe(1610);
  });

  it('defaults to full clientOwes on insurance when override is null', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      isInsurance: true,
      labourLines: [{ subtotal: 1000, tax_rate: 14 }],
      partsLines: [],
      customerPortionOverride: null,
    });
    expect(r.customerPortion).toBe(1140);
    expect(r.insurancePortion).toBe(0);
  });

  it('handles empty lines gracefully', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      labourLines: [],
      partsLines: [],
    });
    expect(r.subtotal).toBe(0);
    expect(r.totalVat).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(r.clientOwes).toBe(0);
    expect(r.legacyTaxRate).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      labourLines: [{ subtotal: 333.333, tax_rate: 14 }],
      partsLines: [],
    });
    // vat = 333.333 * 0.14 = 46.66662
    expect(r.totalVat).toBe(46.67);
    expect(r.labourTotal).toBe(333.33);
  });

  it('treats null tax_rate as 0%', () => {
    const r = computeInvoiceTotals({
      ...baseInput,
      labourLines: [{ subtotal: 1000, tax_rate: null }],
      partsLines: [],
    });
    expect(r.totalVat).toBe(0);
    expect(r.vatByRate['0.00']).toBe(0);
    expect(r.grandTotal).toBe(1000);
  });
});
