import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PartsService } from '../parts/parts.service';
import { CostingService } from '../parts/costing.service';
import type { CreateBillInput, RecordPaymentInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class BillsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly partsService: PartsService,
    private readonly costingService: CostingService,
  ) {}

  async list(tenantId: string, pagination: PaginationInput, vendorId?: string, status?: string) {
    const client = this.supabase.getClient();
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('bills')
      .select('*, vendor:vendors(id, name)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('bills')
      .select('*, vendor:vendors(id, name), lines:bill_lines(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Bill not found');
    }

    // Also fetch payments
    const { data: payments } = await client
      .from('bill_payments')
      .select('*')
      .eq('bill_id', id)
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false });

    return { ...data, payments: payments ?? [] };
  }

  async create(tenantId: string, userId: string, input: CreateBillInput) {
    const client = this.supabase.getClient();

    // Compute total from line items
    const amount = input.lines.reduce((sum, line) => {
      const lineTotal = Math.round(line.quantity * line.unitCost * 100) / 100;
      return sum + lineTotal;
    }, 0);

    // Insert bill record
    const { data: bill, error } = await client
      .from('bills')
      .insert({
        tenant_id: tenantId,
        vendor_id: input.vendorId,
        bill_number: input.billNumber,
        amount: Math.round(amount * 100) / 100,
        paid_amount: 0,
        due_date: input.dueDate,
        purchase_order_id: input.purchaseOrderId || null,
        notes: input.notes || null,
        status: 'unpaid',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert line items
    const lineRecords = input.lines.map((line) => ({
      tenant_id: tenantId,
      bill_id: bill.id,
      part_id: line.partId || null,
      part_name: line.partName,
      part_number: line.partNumber || null,
      quantity: line.quantity,
      unit_cost: line.unitCost,
      total: Math.round(line.quantity * line.unitCost * 100) / 100,
    }));

    const { error: linesError } = await client
      .from('bill_lines')
      .insert(lineRecords);

    if (linesError) throw linesError;

    return this.getById(tenantId, bill.id);
  }

  async approveBill(tenantId: string, id: string, userId: string) {
    const bill = await this.getById(tenantId, id);

    if (bill.approved_at) {
      throw new BadRequestException('Bill has already been approved');
    }

    const client = this.supabase.getClient();
    const lines = (bill.lines ?? []) as Array<Record<string, unknown>>;

    // For each line with a part_id, increase stock and update cost
    for (const line of lines) {
      const partId = line.part_id as string | null;
      if (!partId) continue;

      const qty = line.quantity as number;
      const unitCost = line.unit_cost as number;

      // Increase stock via internal method (bypasses manual adjustment guard)
      await this.partsService.increaseStockInternal(
        tenantId,
        partId,
        userId,
        qty,
        `Supplier invoice: ${bill.bill_number as string}`,
        id,
      );

      // Update cost price via costing service
      try {
        await this.costingService.recalculateCost(tenantId, partId, qty, unitCost);
      } catch {
        // If costing fails, stock was still increased — log but don't rollback
      }
    }

    // Mark bill as approved
    const { data, error } = await client
      .from('bills')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async recordPayment(
    tenantId: string,
    id: string,
    userId: string,
    input: RecordPaymentInput,
  ) {
    const bill = await this.getById(tenantId, id);

    const currentPaid = bill.paid_amount as number;
    const totalAmount = bill.amount as number;
    const newPaid = Math.round((currentPaid + input.amount) * 100) / 100;

    if (newPaid > totalAmount) {
      throw new BadRequestException('Payment exceeds bill amount');
    }

    const status = newPaid >= totalAmount ? 'paid' : 'partial';

    const client = this.supabase.getClient();

    // Record payment in bill_payments table for audit trail
    await client.from('bill_payments').insert({
      tenant_id: tenantId,
      bill_id: id,
      amount: input.amount,
      payment_method: input.paymentMethod || null,
      reference: input.reference || null,
      notes: input.notes || null,
      created_by: userId,
    });

    // Update bill totals
    const { data, error } = await client
      .from('bills')
      .update({
        paid_amount: newPaid,
        status,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
