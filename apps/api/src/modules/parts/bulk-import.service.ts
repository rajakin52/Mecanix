import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../supabase/supabase.service';

interface ImportRow {
  rowNumber: number;
  partNumber?: string;
  description: string;
  unitCost?: number;
  sellPrice?: number;
  stockQty?: number;
  reorderPoint?: number;
  category?: string;
  location?: string;
  barcode?: string;
  sku?: string;
  supplierName?: string;
  isActive?: boolean;
  taxCode?: string;
}

type RowRecord = Record<string, unknown>;

const COLUMN_ALIASES: Record<string, string> = {
  part_number: 'partNumber',
  partnumber: 'partNumber',
  'part number': 'partNumber',
  code: 'partNumber',
  reference: 'partNumber',
  ref: 'partNumber',
  description: 'description',
  name: 'description',
  unit_cost: 'unitCost',
  unitcost: 'unitCost',
  cost: 'unitCost',
  'unit cost': 'unitCost',
  sell_price: 'sellPrice',
  sellprice: 'sellPrice',
  price: 'sellPrice',
  'sell price': 'sellPrice',
  stock_qty: 'stockQty',
  quantity: 'stockQty',
  qty: 'stockQty',
  stock: 'stockQty',
  'stock qty': 'stockQty',
  reorder_point: 'reorderPoint',
  reorder: 'reorderPoint',
  'reorder point': 'reorderPoint',
  min_stock: 'reorderPoint',
  category: 'category',
  group: 'category',
  location: 'location',
  shelf: 'location',
  barcode: 'barcode',
  ean: 'barcode',
  upc: 'barcode',
  sku: 'sku',
  supplier: 'supplierName',
  supplier_name: 'supplierName',
  'supplier name': 'supplierName',
  vendor: 'supplierName',
  is_active: 'isActive',
  active: 'isActive',
  tax_code: 'taxCode',
  iva: 'taxCode',
  vat_code: 'taxCode',
};

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(private readonly supabase: SupabaseService) {}

  generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    const rows = [
      {
        part_number: 'BRK-PAD-001',
        description: 'Front Brake Pads',
        unit_cost: 45.00,
        sell_price: 75.00,
        stock_qty: 10,
        reorder_point: 3,
        category: 'Brakes',
        location: 'Shelf A1',
        barcode: '5901234123457',
        sku: 'SKU-BRK-001',
        supplier: 'ACME Auto Parts',
        tax_code: 'IVA14',
        is_active: true,
      },
      {
        part_number: 'OIL-5W30-5L',
        description: 'Engine Oil 5W-30 Synthetic (5L)',
        unit_cost: 28.50,
        sell_price: 42.00,
        stock_qty: 24,
        reorder_point: 6,
        category: 'Lubricants',
        location: 'Shelf B2',
        barcode: '',
        sku: '',
        supplier: '',
        tax_code: 'IVA14',
        is_active: true,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 22 }, { wch: 10 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, 'Parts');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private parseFile(buffer: Buffer, filename: string): RowRecord[] {
    const lower = filename.toLowerCase();
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');

    if (isExcel) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new BadRequestException('Excel file has no sheets');
      const sheet = wb.Sheets[sheetName];
      if (!sheet) throw new BadRequestException('First sheet is empty');
      return XLSX.utils.sheet_to_json(sheet, { defval: null }) as RowRecord[];
    }

    // CSV fallback
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('File must have a header row and at least one data row');
    const header = (lines[0] ?? '').split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const rec: RowRecord = {};
      header.forEach((h, i) => { rec[h] = cols[i] ?? null; });
      return rec;
    });
  }

  private normalizeRow(raw: RowRecord, rowNumber: number): { row: ImportRow | null; error?: string } {
    const normalized: RowRecord = {};
    for (const [key, value] of Object.entries(raw)) {
      const canonicalKey = COLUMN_ALIASES[key.toLowerCase().trim()];
      if (canonicalKey) normalized[canonicalKey] = value;
    }

    const description = this.toStringOrUndef(normalized.description);
    if (!description) {
      return { row: null, error: `Row ${rowNumber}: missing description` };
    }

    const row: ImportRow = {
      rowNumber,
      description,
      partNumber: this.toStringOrUndef(normalized.partNumber),
      category: this.toStringOrUndef(normalized.category),
      location: this.toStringOrUndef(normalized.location),
      barcode: this.toStringOrUndef(normalized.barcode),
      sku: this.toStringOrUndef(normalized.sku),
      supplierName: this.toStringOrUndef(normalized.supplierName),
      taxCode: this.toStringOrUndef(normalized.taxCode),
    };

    const unitCost = this.toNumberOrUndef(normalized.unitCost);
    if (unitCost !== undefined) {
      if (unitCost < 0) return { row: null, error: `Row ${rowNumber}: unit_cost cannot be negative` };
      row.unitCost = unitCost;
    }

    const sellPrice = this.toNumberOrUndef(normalized.sellPrice);
    if (sellPrice !== undefined) {
      if (sellPrice < 0) return { row: null, error: `Row ${rowNumber}: sell_price cannot be negative` };
      row.sellPrice = sellPrice;
    }

    const stockQty = this.toNumberOrUndef(normalized.stockQty);
    if (stockQty !== undefined) {
      if (!Number.isInteger(stockQty) || stockQty < 0) {
        return { row: null, error: `Row ${rowNumber}: stock_qty must be a non-negative integer` };
      }
      row.stockQty = stockQty;
    }

    const reorderPoint = this.toNumberOrUndef(normalized.reorderPoint);
    if (reorderPoint !== undefined) {
      if (!Number.isInteger(reorderPoint) || reorderPoint < 0) {
        return { row: null, error: `Row ${rowNumber}: reorder_point must be a non-negative integer` };
      }
      row.reorderPoint = reorderPoint;
    }

    if (normalized.isActive !== undefined && normalized.isActive !== null && normalized.isActive !== '') {
      row.isActive = this.toBool(normalized.isActive);
    }

    return { row };
  }

  private toStringOrUndef(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
  }

  private toNumberOrUndef(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : undefined;
  }

  private toBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'sim', 'active'].includes(s);
  }

  async processUpload(
    tenantId: string,
    userId: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    const rawRows = this.parseFile(fileBuffer, filename);
    if (!rawRows.length) throw new BadRequestException('No data rows found');

    const rows: ImportRow[] = [];
    const errors: string[] = [];

    rawRows.forEach((raw, i) => {
      const { row, error } = this.normalizeRow(raw, i + 2); // +2: row 1 = header, data starts at 2
      if (error) errors.push(error);
      else if (row) rows.push(row);
    });

    if (!rows.length) {
      throw new BadRequestException(`No valid rows to import. First errors: ${errors.slice(0, 5).join('; ')}`);
    }

    const client = this.supabase.getClient();

    // Preload suppliers for name→id resolution (case-insensitive)
    const { data: vendors } = await client
      .from('vendors')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    const supplierMap = new Map<string, string>();
    (vendors ?? []).forEach((v: { id: string; name: string }) => {
      supplierMap.set(v.name.toLowerCase().trim(), v.id);
    });

    // Preload tax codes for code→id resolution.
    const { data: taxCodes } = await client
      .from('tax_codes')
      .select('id, code, is_default')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    const taxCodeMap = new Map<string, string>();
    let defaultTaxCodeId: string | null = null;
    (taxCodes ?? []).forEach((t: { id: string; code: string; is_default: boolean }) => {
      taxCodeMap.set(t.code.toLowerCase().trim(), t.id);
      if (t.is_default) defaultTaxCodeId = t.id;
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        // Resolve supplier
        let supplierId: string | null = null;
        if (row.supplierName) {
          supplierId = supplierMap.get(row.supplierName.toLowerCase().trim()) ?? null;
          if (!supplierId) {
            errors.push(`Row ${row.rowNumber}: supplier "${row.supplierName}" not found — part imported without supplier`);
          }
        }

        // Find existing part by part_number
        let existing: { id: string } | null = null;
        if (row.partNumber) {
          const { data } = await client
            .from('parts')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('part_number', row.partNumber)
            .maybeSingle();
          existing = data;
        }

        const payload: Record<string, unknown> = {
          description: row.description,
          updated_by: userId,
        };
        if (row.partNumber !== undefined) payload.part_number = row.partNumber;
        if (row.unitCost !== undefined) payload.unit_cost = row.unitCost;
        if (row.sellPrice !== undefined) payload.sell_price = row.sellPrice;
        if (row.stockQty !== undefined) payload.stock_qty = row.stockQty;
        if (row.reorderPoint !== undefined) payload.reorder_point = row.reorderPoint;
        if (row.category !== undefined) payload.category = row.category;
        if (row.location !== undefined) payload.location = row.location;
        if (row.barcode !== undefined) payload.barcode = row.barcode;
        if (row.sku !== undefined) payload.sku = row.sku;
        if (supplierId) payload.supplier_id = supplierId;
        if (row.isActive !== undefined) payload.is_active = row.isActive;

        // Resolve tax code: explicit column first, else tenant default.
        if (row.taxCode) {
          const resolved = taxCodeMap.get(row.taxCode.toLowerCase().trim());
          if (resolved) payload.tax_code_id = resolved;
          else errors.push(`Row ${row.rowNumber}: tax code "${row.taxCode}" not found — using default IVA14`);
        }
        if (payload.tax_code_id === undefined && defaultTaxCodeId) {
          payload.tax_code_id = defaultTaxCodeId;
        }

        if (existing) {
          const { error: updErr } = await client
            .from('parts')
            .update(payload)
            .eq('id', existing.id)
            .eq('tenant_id', tenantId);
          if (updErr) {
            errors.push(`Row ${row.rowNumber}: update failed — ${updErr.message}`);
            skipped++;
          } else {
            updated++;
          }
        } else {
          const { error: insErr } = await client
            .from('parts')
            .insert({
              tenant_id: tenantId,
              is_active: true,
              unit_cost: 0,
              sell_price: 0,
              stock_qty: 0,
              reorder_point: 0,
              ...payload,
              created_by: userId,
            });
          if (insErr) {
            errors.push(`Row ${row.rowNumber}: create failed — ${insErr.message}`);
            skipped++;
          } else {
            created++;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`bulk import row ${row.rowNumber}: ${msg}`);
        errors.push(`Row ${row.rowNumber}: ${msg}`);
        skipped++;
      }
    }

    return { processed: rows.length, created, updated, skipped, errors };
  }
}
