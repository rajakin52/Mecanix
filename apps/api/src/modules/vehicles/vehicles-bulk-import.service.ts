import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../supabase/supabase.service';

interface ImportRow {
  rowNumber: number;
  plate: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  color?: string;
  fuelType?: string;
  engineSize?: string;
  mileage?: number;
  notes?: string;
  customerPhone?: string;
  customerName?: string;
}

type RowRecord = Record<string, unknown>;

const COLUMN_ALIASES: Record<string, string> = {
  plate: 'plate',
  matricula: 'plate',
  'matrícula': 'plate',
  'license plate': 'plate',

  make: 'make',
  marca: 'make',
  brand: 'make',

  model: 'model',
  modelo: 'model',

  year: 'year',
  ano: 'year',

  vin: 'vin',
  chassis: 'vin',
  chassi: 'vin',

  color: 'color',
  cor: 'color',
  colour: 'color',

  fuel_type: 'fuelType',
  fuel: 'fuelType',
  combustivel: 'fuelType',
  'combustível': 'fuelType',

  engine_size: 'engineSize',
  'engine size': 'engineSize',
  cilindrada: 'engineSize',

  mileage: 'mileage',
  km: 'mileage',
  quilometragem: 'mileage',

  notes: 'notes',
  observacoes: 'notes',
  'observações': 'notes',

  customer_phone: 'customerPhone',
  'customer phone': 'customerPhone',
  phone: 'customerPhone',
  telefone: 'customerPhone',
  tel: 'customerPhone',

  customer_name: 'customerName',
  'customer name': 'customerName',
  customer: 'customerName',
  cliente: 'customerName',
  owner: 'customerName',
};

const FUEL_TYPES = new Set(['petrol', 'diesel', 'electric', 'hybrid', 'lpg']);

@Injectable()
export class VehiclesBulkImportService {
  private readonly logger = new Logger(VehiclesBulkImportService.name);

  constructor(private readonly supabase: SupabaseService) {}

  generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    const rows = [
      {
        plate: 'LD-01-23-AA',
        make: 'Toyota',
        model: 'Corolla',
        year: 2018,
        vin: 'JT2BF22K1X0000000',
        color: 'White',
        fuel_type: 'petrol',
        engine_size: '1.6',
        mileage: 85000,
        customer_phone: '923000001',
        customer_name: 'João Silva',
        notes: '',
      },
      {
        plate: 'LD-02-23-BB',
        make: 'Hyundai',
        model: 'HR',
        year: 2019,
        vin: '',
        color: 'Blue',
        fuel_type: 'diesel',
        engine_size: '2.5',
        mileage: 120000,
        customer_phone: '923000002',
        customer_name: '',
        notes: 'Fleet vehicle',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
      { wch: 24 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, 'Vehicles');
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

    const plate = this.toStringOrUndef(normalized.plate);
    const make = this.toStringOrUndef(normalized.make);
    const model = this.toStringOrUndef(normalized.model);
    if (!plate) return { row: null, error: `Row ${rowNumber}: plate is required` };
    if (!make) return { row: null, error: `Row ${rowNumber}: make is required` };
    if (!model) return { row: null, error: `Row ${rowNumber}: model is required` };

    const row: ImportRow = {
      rowNumber,
      plate: plate.toUpperCase(),
      make,
      model,
      vin: this.toStringOrUndef(normalized.vin)?.toUpperCase(),
      color: this.toStringOrUndef(normalized.color),
      engineSize: this.toStringOrUndef(normalized.engineSize),
      notes: this.toStringOrUndef(normalized.notes),
      customerPhone: this.toStringOrUndef(normalized.customerPhone),
      customerName: this.toStringOrUndef(normalized.customerName),
    };

    const year = this.toNumberOrUndef(normalized.year);
    if (year !== undefined) {
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        return { row: null, error: `Row ${rowNumber}: year must be 1900-2100` };
      }
      row.year = year;
    }

    const mileage = this.toNumberOrUndef(normalized.mileage);
    if (mileage !== undefined) {
      if (!Number.isInteger(mileage) || mileage < 0) {
        return { row: null, error: `Row ${rowNumber}: mileage must be a non-negative integer` };
      }
      row.mileage = mileage;
    }

    const fuel = this.toStringOrUndef(normalized.fuelType)?.toLowerCase();
    if (fuel !== undefined) {
      if (!FUEL_TYPES.has(fuel)) {
        return {
          row: null,
          error: `Row ${rowNumber}: fuel_type must be one of ${[...FUEL_TYPES].join(', ')}`,
        };
      }
      row.fuelType = fuel;
    }

    if (!row.customerPhone && !row.customerName) {
      return { row: null, error: `Row ${rowNumber}: provide customer_phone or customer_name to link the owner` };
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
      const { row, error } = this.normalizeRow(raw, i + 2);
      if (error) errors.push(error);
      else if (row) rows.push(row);
    });

    if (!rows.length) {
      throw new BadRequestException(`No valid rows to import. First errors: ${errors.slice(0, 5).join('; ')}`);
    }

    const client = this.supabase.getClient();

    // Preload customers for name+phone → id resolution. Phone wins over name
    // because names collide but phones are (usually) unique.
    const { data: customers } = await client
      .from('customers')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId);
    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    (customers ?? []).forEach((c: { id: string; full_name: string; phone: string | null }) => {
      if (c.phone) {
        const digits = c.phone.replace(/\D/g, '');
        byPhone.set(digits, c.id);
        // also index last 9 digits so '923…' matches '+244923…'
        if (digits.length > 9) byPhone.set(digits.slice(-9), c.id);
      }
      if (c.full_name) byName.set(c.full_name.toLowerCase().trim(), c.id);
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        // Resolve customer
        let customerId: string | null = null;
        if (row.customerPhone) {
          const digits = row.customerPhone.replace(/\D/g, '');
          customerId = byPhone.get(digits)
            ?? (digits.length >= 9 ? byPhone.get(digits.slice(-9)) : undefined)
            ?? null;
        }
        if (!customerId && row.customerName) {
          customerId = byName.get(row.customerName.toLowerCase().trim()) ?? null;
        }
        if (!customerId) {
          errors.push(`Row ${row.rowNumber}: customer "${row.customerPhone ?? row.customerName}" not found — skipped`);
          skipped++;
          continue;
        }

        const payload: Record<string, unknown> = {
          plate: row.plate,
          make: row.make,
          model: row.model,
          updated_by: userId,
        };
        if (row.year !== undefined) payload.year = row.year;
        if (row.vin !== undefined) payload.vin = row.vin;
        if (row.color !== undefined) payload.color = row.color;
        if (row.fuelType !== undefined) payload.fuel_type = row.fuelType;
        if (row.engineSize !== undefined) payload.engine_size = row.engineSize;
        if (row.mileage !== undefined) payload.mileage = row.mileage;
        if (row.notes !== undefined) payload.notes = row.notes;

        // Upsert by (tenant_id, plate)
        const { data: existing } = await client
          .from('vehicles')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('plate', row.plate)
          .is('deleted_at', null)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await client
            .from('vehicles')
            .update({ ...payload, customer_id: customerId })
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
            .from('vehicles')
            .insert({
              tenant_id: tenantId,
              customer_id: customerId,
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
        this.logger.error(`vehicles bulk import row ${row.rowNumber}: ${msg}`);
        errors.push(`Row ${row.rowNumber}: ${msg}`);
        skipped++;
      }
    }

    return { processed: rows.length, created, updated, skipped, errors };
  }
}
