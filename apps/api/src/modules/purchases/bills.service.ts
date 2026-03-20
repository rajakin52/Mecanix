import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateBillInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class BillsService {
  constructor(private readonly supabase: SupabaseService) {}

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
    const { data, error } = await this.supabase
      .getClient()
      .from('bills')
      .select('*, vendor:vendors(id, name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Bill not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateBillInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('bills')
      .insert({
        tenant_id: tenantId,
        vendor_id: input.vendorId,
        bill_number: input.billNumber,
        amount: input.amount,
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
    return data;
  }

  async recordPayment(tenantId: string, id: string, userId: string, amount: number) {
    const bill = await this.getById(tenantId, id);

    const currentPaid = bill.paid_amount as number;
    const totalAmount = bill.amount as number;
    const newPaid = Math.round((currentPaid + amount) * 100) / 100;

    if (newPaid > totalAmount) {
      throw new BadRequestException('Payment exceeds bill amount');
    }

    const status = newPaid >= totalAmount ? 'paid' : 'partial';

    const { data, error } = await this.supabase
      .getClient()
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
