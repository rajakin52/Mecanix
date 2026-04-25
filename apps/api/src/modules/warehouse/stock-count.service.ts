import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateCountInput {
  warehouseId: string;
  categoryFilter?: string;
  notes?: string;
}

interface UpdateCountLineInput {
  countedQty: number;
  notes?: string;
}

@Injectable()
export class StockCountService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCounts(tenantId: string, page = 1, pageSize = 50) {
    const { data, error, count } = await this.supabase
      .getClient()
      .from('stock_counts')
      .select('*, warehouse:warehouses(id, name, code)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    // Flatten warehouse to top-level warehouse_name so the table can
    // render it directly (matches the StockCount type the UI uses).
    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const wh = Array.isArray(row.warehouse) ? row.warehouse[0] : row.warehouse;
      return {
        ...row,
        warehouse_name: (wh as { name?: string } | null)?.name ?? null,
        warehouse_code: (wh as { code?: string } | null)?.code ?? null,
      };
    });

    const total = count ?? rows.length;
    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getCount(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('stock_counts')
      .select('*, warehouse:warehouses(id, name, code)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Stock count not found');
    }

    // Fetch lines with part details. Includes location + category so
    // the XLSX export can render them without a follow-up .in() query
    // (which was hitting PostgREST URL-length limits at ~500+ part ids
    // and silently returning no rows).
    const { data: lines, error: linesErr } = await client
      .from('stock_count_lines')
      .select('*, part:parts(id, part_number, description, unit_cost, location, category)')
      .eq('stock_count_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (linesErr) throw linesErr;

    return { ...data, lines: lines ?? [] };
  }

  async createCount(tenantId: string, userId: string, input: CreateCountInput) {
    const client = this.supabase.getClient();

    // Generate count number via RPC
    const { data: countNumber, error: rpcErr } = await client
      .rpc('generate_count_number', { p_tenant_id: tenantId });

    if (rpcErr) throw rpcErr;

    // Create stock count header
    const { data: stockCount, error: countErr } = await client
      .from('stock_counts')
      .insert({
        tenant_id: tenantId,
        count_number: countNumber,
        warehouse_id: input.warehouseId,
        status: 'in_progress',
        category_filter: input.categoryFilter || null,
        notes: input.notes || null,
        counted_by: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (countErr) throw countErr;

    // Get all parts in this warehouse to populate lines
    let stockQuery = client
      .from('warehouse_stock')
      .select('part_id, quantity')
      .eq('warehouse_id', input.warehouseId)
      .eq('tenant_id', tenantId);

    // If category filter, we need to join parts to filter
    const { data: warehouseStock, error: stockErr } = await stockQuery;

    if (stockErr) throw stockErr;

    if (warehouseStock && warehouseStock.length > 0) {
      let partIds = warehouseStock.map((s) => s.part_id as string);

      // If category filter is set, filter parts by category
      if (input.categoryFilter) {
        const { data: filteredParts, error: fpErr } = await client
          .from('parts')
          .select('id')
          .in('id', partIds)
          .eq('category', input.categoryFilter)
          .eq('tenant_id', tenantId);

        if (fpErr) throw fpErr;
        partIds = (filteredParts ?? []).map((p) => p.id as string);
      }

      // Build stock map for quick lookup
      const stockMap = new Map<string, number>();
      for (const s of warehouseStock) {
        stockMap.set(s.part_id as string, s.quantity as number);
      }

      // Create count lines for matching parts
      if (partIds.length > 0) {
        const lineInserts = partIds.map((partId) => ({
          tenant_id: tenantId,
          stock_count_id: stockCount.id,
          part_id: partId,
          system_qty: stockMap.get(partId) ?? 0,
        }));

        const { error: linesErr } = await client
          .from('stock_count_lines')
          .insert(lineInserts);

        if (linesErr) throw linesErr;
      }
    }

    return this.getCount(tenantId, stockCount.id);
  }

  /**
   * Add an extra part to an in-progress stock count. Used when the
   * counter discovers a SKU on the shelf that the system didn't know
   * was in this warehouse — no row in `warehouse_stock` for it (or it
   * exists with quantity 0). Inserted with system_qty pulled from
   * warehouse_stock if present, else 0.
   */
  async addLine(tenantId: string, countId: string, partId: string) {
    const client = this.supabase.getClient();

    const count = await this.getCount(tenantId, countId);
    if (count.status !== 'in_progress') {
      throw new BadRequestException(`Cannot add lines to a ${count.status} stock count`);
    }

    const warehouseId = count.warehouse_id as string;

    // Verify the part exists in this tenant's catalog.
    const { data: part, error: partErr } = await client
      .from('parts')
      .select('id, category')
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (partErr) throw partErr;
    if (!part) throw new NotFoundException('Part not found in catalog');

    // If the count was scoped by category, refuse to add cross-category parts.
    const categoryFilter = count.category_filter as string | null;
    if (categoryFilter && (part.category as string | null) !== categoryFilter) {
      throw new BadRequestException(
        `This count is scoped to category "${categoryFilter}"; the part belongs to "${part.category ?? 'none'}"`,
      );
    }

    // Refuse duplicates — a line for this part already exists.
    const { data: existing } = await client
      .from('stock_count_lines')
      .select('id')
      .eq('stock_count_id', countId)
      .eq('part_id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('This part is already in the count');
    }

    // Pull current system quantity from warehouse_stock; 0 if no row.
    const { data: stockRow } = await client
      .from('warehouse_stock')
      .select('quantity')
      .eq('warehouse_id', warehouseId)
      .eq('part_id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const systemQty = (stockRow?.quantity as number | undefined) ?? 0;

    const { data, error } = await client
      .from('stock_count_lines')
      .insert({
        tenant_id: tenantId,
        stock_count_id: countId,
        part_id: partId,
        system_qty: systemQty,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCountLine(
    tenantId: string,
    countId: string,
    lineId: string,
    input: UpdateCountLineInput,
  ) {
    const client = this.supabase.getClient();

    // Verify the count exists and is editable
    const count = await this.getCount(tenantId, countId);
    if (count.status === 'completed' || count.status === 'cancelled') {
      throw new BadRequestException(`Cannot update lines on a ${count.status} stock count`);
    }

    const updateData: Record<string, unknown> = {
      counted_qty: input.countedQty,
    };

    if (input.notes !== undefined) {
      updateData.notes = input.notes || null;
    }

    // Calculate variance_cost: we need the part's unit_cost
    const { data: line, error: lineErr } = await client
      .from('stock_count_lines')
      .select('system_qty, part:parts(unit_cost)')
      .eq('id', lineId)
      .eq('stock_count_id', countId)
      .eq('tenant_id', tenantId)
      .single();

    if (lineErr || !line) {
      throw new NotFoundException('Stock count line not found');
    }

    const systemQty = line.system_qty as number;
    const unitCost = (line.part as unknown as Record<string, unknown>)?.unit_cost as number ?? 0;
    const variance = input.countedQty - systemQty;
    updateData.variance_cost = Math.round(variance * unitCost * 100) / 100;

    const { data, error } = await client
      .from('stock_count_lines')
      .update(updateData)
      .eq('id', lineId)
      .eq('stock_count_id', countId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async approveCount(tenantId: string, countId: string, userId: string) {
    const client = this.supabase.getClient();

    const count = await this.getCount(tenantId, countId);

    if (count.status === 'completed') {
      throw new BadRequestException('Stock count is already completed');
    }

    if (count.status === 'cancelled') {
      throw new BadRequestException('Cannot approve a cancelled stock count');
    }

    const warehouseId = count.warehouse_id as string;
    const countNumber = count.count_number as string;
    const lines = count.lines as Array<Record<string, unknown>>;

    // Process each line with a variance
    for (const line of lines) {
      const countedQty = line.counted_qty as number | null;
      if (countedQty === null) continue; // Skip lines not yet counted

      const systemQty = line.system_qty as number;
      const variance = countedQty - systemQty;

      if (variance === 0) continue; // No adjustment needed

      const partId = line.part_id as string;

      // Adjust warehouse_stock
      const { data: stock, error: stockErr } = await client
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', warehouseId)
        .eq('part_id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (stockErr || !stock) {
        throw new BadRequestException(`Stock record not found for part ${partId}`);
      }

      const newQty = (stock.quantity as number) + variance;
      if (newQty < 0) {
        throw new BadRequestException(`Adjustment would result in negative stock for part ${partId}`);
      }

      const { error: updateErr } = await client
        .from('warehouse_stock')
        .update({ quantity: newQty })
        .eq('id', stock.id)
        .eq('tenant_id', tenantId);

      if (updateErr) throw updateErr;

      // Record inventory adjustment
      const { error: adjErr } = await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: partId,
          warehouse_id: warehouseId,
          quantity_change: variance,
          reason: `Stock count adjustment: ${countNumber}`,
          reference: countNumber,
          adjusted_by: userId,
        });

      if (adjErr) throw adjErr;
    }

    // Mark count as completed
    const { data, error } = await client
      .from('stock_counts')
      .update({
        status: 'completed',
        approved_by: userId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', countId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancelCount(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const count = await this.getCount(tenantId, id);

    if (count.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed stock count');
    }

    if (count.status === 'cancelled') {
      throw new BadRequestException('Stock count is already cancelled');
    }

    const { data, error } = await client
      .from('stock_counts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Export / Import ────────────────────────────────────────────
  // Workshops often want to print a count sheet, walk the warehouse
  // with a clipboard, fill counted_qty by hand, then transcribe back.
  // Export produces an XLSX with the prefilled lines + an empty
  // counted_qty column. Import reads it back, matching by part_id
  // (hidden column) or part_number, and updates counted_qty on each
  // matching line. Idempotent — re-uploading the same file leaves
  // no extra state.

  async exportToXlsx(
    tenantId: string,
    countId: string,
    sortBy: 'part_number' | 'description' | 'location' = 'part_number',
  ): Promise<{ fileName: string; contentType: string; base64: string }> {
    const count = await this.getCount(tenantId, countId);
    const lines = (count.lines as Array<Record<string, unknown>>) ?? [];

    // Each line already carries an embedded `part` thanks to the
    // join in getCount. No extra query needed (and the previous
    // .in() approach failed silently on 500+ ids — URL too long).
    const rows = lines.map((line) => {
      const partRel = line.part as Record<string, unknown> | Record<string, unknown>[] | null;
      const part = (Array.isArray(partRel) ? partRel[0] : partRel) ?? {};
      return {
        'Part Number': (part.part_number as string | null) ?? '',
        Description: (part.description as string | null) ?? '',
        Location: (part.location as string | null) ?? '',
        Category: (part.category as string | null) ?? '',
        'System Qty': line.system_qty ?? 0,
        'Counted Qty': line.counted_qty ?? '',
        Notes: line.notes ?? '',
        // Hidden column — used by import to match unambiguously even
        // if part_number changes between export and re-upload.
        '__part_id': line.part_id,
      };
    });

    rows.sort((a, b) => {
      const key = sortBy === 'description' ? 'Description' : sortBy === 'location' ? 'Location' : 'Part Number';
      const av = String(a[key as keyof typeof a] ?? '');
      const bv = String(b[key as keyof typeof b] ?? '');
      return av.localeCompare(bv);
    });

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['Part Number', 'Description', 'Location', 'Category', 'System Qty', 'Counted Qty', 'Notes', '__part_id'],
    });

    // Hide the __part_id column visually but keep it in the file.
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'][7] = { hidden: true } as XLSX.ColInfo;

    // Modest column widths so the printed sheet is usable.
    ws['!cols'][0] = { wch: 18 };
    ws['!cols'][1] = { wch: 40 };
    ws['!cols'][2] = { wch: 14 };
    ws['!cols'][3] = { wch: 14 };
    ws['!cols'][4] = { wch: 12 };
    ws['!cols'][5] = { wch: 14 };
    ws['!cols'][6] = { wch: 30 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Count');
    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const fileName = `${(count.count_number as string | null) ?? 'stock-count'}.xlsx`;
    return {
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
  }

  async importFromXlsx(
    tenantId: string,
    countId: string,
    fileBuffer: Buffer,
  ): Promise<{ matched: number; skipped: number; errors: string[] }> {
    const count = await this.getCount(tenantId, countId);
    if (count.status !== 'in_progress') {
      throw new BadRequestException(`Cannot import into a ${count.status} stock count`);
    }

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException(`Failed to parse XLSX: ${e instanceof Error ? e.message : String(e)}`);
    }

    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Workbook contains no sheets');
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws as XLSX.WorkSheet) as Array<Record<string, unknown>>;

    const linesById = new Map<string, Record<string, unknown>>();
    const linesByPartNumber = new Map<string, Record<string, unknown>>();
    for (const line of (count.lines as Array<Record<string, unknown>>) ?? []) {
      linesById.set(line.part_id as string, line);
      const pn = line.part_number as string | undefined;
      if (pn) linesByPartNumber.set(pn.toLowerCase().trim(), line);
    }

    let matched = 0;
    let skipped = 0;
    const errors: string[] = [];
    let rowNum = 1;

    for (const row of rows) {
      rowNum++;

      // Read the counted quantity. Empty / blank cells mean "not yet
      // counted" — leave the line alone.
      const rawCounted = row['Counted Qty'] ?? row['counted_qty'] ?? row.countedQty;
      if (rawCounted === undefined || rawCounted === null || rawCounted === '') {
        skipped++;
        continue;
      }
      const countedQty = Number(rawCounted);
      if (Number.isNaN(countedQty) || countedQty < 0) {
        errors.push(`Row ${rowNum}: invalid counted qty "${String(rawCounted)}"`);
        continue;
      }

      // Match: hidden __part_id wins, fallback to Part Number.
      const partId = row['__part_id'] as string | undefined;
      const partNumber = (row['Part Number'] ?? row['part_number'] ?? row.partNumber) as string | undefined;
      const line = (partId && linesById.get(partId)) ||
        (partNumber && linesByPartNumber.get(String(partNumber).toLowerCase().trim()));

      if (!line) {
        errors.push(`Row ${rowNum}: no matching count line for part "${partNumber ?? partId ?? '(blank)'}"`);
        continue;
      }

      const notes = row['Notes'] ?? row.notes;
      try {
        await this.updateCountLine(tenantId, countId, line.id as string, {
          countedQty,
          notes: notes !== undefined && notes !== null && String(notes).trim() !== '' ? String(notes) : undefined,
        });
        matched++;
      } catch (e) {
        errors.push(`Row ${rowNum}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { matched, skipped, errors };
  }
}
