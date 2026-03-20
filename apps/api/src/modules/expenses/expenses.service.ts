import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateExpenseInput, UpdateExpenseInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class ExpensesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    tenantId: string,
    pagination: PaginationInput,
    category?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const client = this.supabase.getClient();
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }

    if (endDate) {
      query = query.lte('expense_date', endDate);
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
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Expense not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateExpenseInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        expense_date: input.expenseDate,
        receipt_url: input.receiptUrl || null,
        notes: input.notes || null,
        created_by: userId,
        
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateExpenseInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      category: 'category',
      description: 'description',
      amount: 'amount',
      expenseDate: 'expense_date',
      receiptUrl: 'receipt_url',
      notes: 'notes',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string, userId: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('expenses')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async getByCategory(tenantId: string, startDate?: string, endDate?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('expenses')
      .select('category, amount')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }

    if (endDate) {
      query = query.lte('expense_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Group by category and sum amounts
    const grouped: Record<string, number> = {};
    for (const row of data ?? []) {
      const cat = row.category as string;
      grouped[cat] = (grouped[cat] ?? 0) + (row.amount as number);
    }

    return Object.entries(grouped).map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }));
  }
}
