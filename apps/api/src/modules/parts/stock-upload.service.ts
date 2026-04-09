import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PartsService } from './parts.service';

interface UploadRow {
  partNumber?: string;
  description: string;
  quantity: number;
  unitCost?: number;
  category?: string;
  location?: string;
}

@Injectable()
export class StockUploadService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly partsService: PartsService,
  ) {}

  generateTemplate(): Buffer {
    const header = 'part_number,description,quantity,unit_cost,category,location';
    const example = 'BRK-PAD-001,Front Brake Pads,10,45.00,Brakes,Shelf A1';
    const csv = `${header}\n${example}\n`;
    return Buffer.from(csv, 'utf-8');
  }

  async processUpload(
    tenantId: string,
    userId: string,
    fileBuffer: Buffer,
  ) {
    const content = fileBuffer.toString('utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException('File must contain a header row and at least one data row');
    }

    // Parse header
    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const descIdx = header.indexOf('description');
    const qtyIdx = header.indexOf('quantity');

    if (descIdx === -1 || qtyIdx === -1) {
      throw new BadRequestException('File must contain "description" and "quantity" columns');
    }

    const partNumIdx = header.indexOf('part_number');
    const costIdx = header.indexOf('unit_cost');
    const catIdx = header.indexOf('category');
    const locIdx = header.indexOf('location');

    // Parse rows
    const rows: UploadRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const desc = cols[descIdx] ?? '';
      const qtyRaw = cols[qtyIdx] ?? '';

      if (!desc) {
        errors.push(`Row ${i + 1}: missing description`);
        continue;
      }

      const qty = parseInt(qtyRaw, 10);
      if (isNaN(qty) || qty < 0) {
        errors.push(`Row ${i + 1}: invalid quantity "${qtyRaw}"`);
        continue;
      }

      const row: UploadRow = { description: desc, quantity: qty };
      if (partNumIdx >= 0 && cols[partNumIdx]) row.partNumber = cols[partNumIdx];
      if (costIdx >= 0 && cols[costIdx]) {
        const cost = parseFloat(cols[costIdx]);
        if (!isNaN(cost)) row.unitCost = cost;
      }
      if (catIdx >= 0 && cols[catIdx]) row.category = cols[catIdx];
      if (locIdx >= 0 && cols[locIdx]) row.location = cols[locIdx];

      rows.push(row);
    }

    if (rows.length === 0) {
      throw new BadRequestException(`No valid rows found. Errors: ${errors.join('; ')}`);
    }

    // Process rows
    const client = this.supabase.getClient();
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      // Try to find existing part by part_number
      let existingPart: Record<string, unknown> | null = null;

      if (row.partNumber) {
        const { data } = await client
          .from('parts')
          .select('id, stock_qty')
          .eq('tenant_id', tenantId)
          .eq('part_number', row.partNumber)
          .eq('is_active', true)
          .maybeSingle();
        existingPart = data;
      }

      if (existingPart) {
        // Update existing part stock
        await this.partsService.increaseStockInternal(
          tenantId,
          existingPart.id as string,
          userId,
          row.quantity,
          'Initial stock upload',
          'INIT',
        );

        // Update cost if provided
        if (row.unitCost !== undefined) {
          await client
            .from('parts')
            .update({
              unit_cost: row.unitCost,
              sell_price: row.unitCost, // Default sell = cost, can be adjusted
              updated_by: userId,
            })
            .eq('id', existingPart.id as string)
            .eq('tenant_id', tenantId);
        }

        updated++;
      } else {
        // Create new part with stock = 0 first
        const { data: newPart, error: createError } = await client
          .from('parts')
          .insert({
            tenant_id: tenantId,
            part_number: row.partNumber || null,
            description: row.description,
            unit_cost: row.unitCost ?? 0,
            sell_price: row.unitCost ?? 0,
            stock_qty: 0,
            reorder_point: 0,
            category: row.category || null,
            location: row.location || null,
            is_active: true,
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (createError) {
          errors.push(`Failed to create "${row.description}": ${createError.message}`);
          continue;
        }

        // Then increase stock via internal method
        if (row.quantity > 0) {
          await this.partsService.increaseStockInternal(
            tenantId,
            newPart.id,
            userId,
            row.quantity,
            'Initial stock upload',
            'INIT',
          );
        }

        created++;
      }
    }

    return {
      processed: rows.length,
      created,
      updated,
      errors,
    };
  }
}
