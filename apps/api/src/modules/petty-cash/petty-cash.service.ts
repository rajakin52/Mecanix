import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreatePettyCashInput {
  transactionType: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  category?: string;
  reference?: string;
  transactionDate?: string;
}

@Injectable()
export class PettyCashService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, startDate?: string, endDate?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('petty_cash')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data ?? [];
  }

  async create(tenantId: string, userId: string, input: CreatePettyCashInput) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('petty_cash')
      .insert({
        tenant_id: tenantId,
        transaction_type: input.transactionType,
        amount: input.amount,
        description: input.description,
        category: input.category || null,
        reference: input.reference || null,
        transaction_date: input.transactionDate || new Date().toISOString().slice(0, 10),
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getBalance(tenantId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('petty_cash')
      .select('transaction_type, amount')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    let balance = 0;
    for (const row of data ?? []) {
      if (row.transaction_type === 'deposit') {
        balance += Number(row.amount);
      } else {
        balance -= Number(row.amount);
      }
    }

    return { balance: Math.round(balance * 100) / 100 };
  }
}
