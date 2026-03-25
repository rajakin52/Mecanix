import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  OpenRegisterInput,
  CloseRegisterInput,
  CreateTransactionInput,
  CreateBankDepositInput,
} from '@mecanix/validators';

@Injectable()
export class CashRegisterService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Open a new cash register session.
   */
  async open(tenantId: string, userId: string, input: OpenRegisterInput) {
    const client = this.supabase.getClient();

    // Check if one is already open
    const { data: existing } = await client
      .from('cash_registers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('A cash register is already open. Close it first.');
    }

    // Create register
    const { data, error } = await client
      .from('cash_registers')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId ?? null,
        status: 'open',
        opened_by: userId,
        opening_float: input.openingFloat ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Record float as first transaction
    if (input.openingFloat > 0) {
      await client.from('cash_transactions').insert({
        tenant_id: tenantId,
        register_id: data.id,
        transaction_type: 'float',
        payment_method: 'cash',
        amount: input.openingFloat,
        description: 'Opening float',
        created_by: userId,
      });
    }

    return data;
  }

  /**
   * Get the current open register.
   */
  async getCurrent(tenantId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('cash_registers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Close the current register with cash count.
   */
  async close(tenantId: string, userId: string, input: CloseRegisterInput) {
    const client = this.supabase.getClient();

    const register = await this.getCurrent(tenantId);
    if (!register) {
      throw new BadRequestException('No open register found');
    }

    // Calculate expected cash from transactions
    const { data: transactions } = await client
      .from('cash_transactions')
      .select('transaction_type, payment_method, amount')
      .eq('register_id', register.id);

    let totalCashIn = 0;
    let totalCardIn = 0;
    let totalMobileIn = 0;
    let totalTransferIn = 0;
    let totalRefunds = 0;
    let totalPettyOut = 0;
    let totalDeposits = 0;

    for (const tx of transactions ?? []) {
      const amt = Number(tx.amount);
      if (tx.transaction_type === 'refund') {
        totalRefunds += Math.abs(amt);
      } else if (tx.transaction_type === 'petty_cash') {
        totalPettyOut += Math.abs(amt);
      } else if (tx.transaction_type === 'deposit') {
        totalDeposits += Math.abs(amt);
      } else if (amt > 0) {
        switch (tx.payment_method) {
          case 'cash': totalCashIn += amt; break;
          case 'card': totalCardIn += amt; break;
          case 'mpesa': case 'multicaixa': case 'emola': case 'mbway':
            totalMobileIn += amt; break;
          case 'transfer': case 'multibanco': case 'pix':
            totalTransferIn += amt; break;
          default: totalCashIn += amt;
        }
      }
    }

    const expectedCash = totalCashIn - totalRefunds - totalPettyOut - totalDeposits;
    const discrepancy = input.closingCash - expectedCash;

    const rounded = (n: number) => Math.round(n * 100) / 100;

    const { data, error } = await client
      .from('cash_registers')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: userId,
        closing_cash: input.closingCash,
        expected_cash: rounded(expectedCash),
        discrepancy: rounded(discrepancy),
        close_notes: input.closeNotes ?? null,
        total_cash_in: rounded(totalCashIn),
        total_card_in: rounded(totalCardIn),
        total_mobile_in: rounded(totalMobileIn),
        total_transfer_in: rounded(totalTransferIn),
        total_refunds: rounded(totalRefunds),
        total_petty_out: rounded(totalPettyOut),
        total_deposits: rounded(totalDeposits),
      })
      .eq('id', register.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Add a transaction to the current register.
   */
  async addTransaction(tenantId: string, userId: string, input: CreateTransactionInput) {
    const register = await this.getCurrent(tenantId);
    if (!register) {
      throw new BadRequestException('No open register. Open one first.');
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('cash_transactions')
      .insert({
        tenant_id: tenantId,
        register_id: register.id,
        transaction_type: input.transactionType,
        payment_method: input.paymentMethod,
        amount: input.transactionType === 'refund' || input.transactionType === 'petty_cash' || input.transactionType === 'deposit'
          ? -Math.abs(input.amount)
          : Math.abs(input.amount),
        invoice_id: input.invoiceId ?? null,
        job_card_id: input.jobCardId ?? null,
        description: input.description ?? null,
        reference: input.reference ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Record a bank deposit.
   */
  async addBankDeposit(tenantId: string, userId: string, input: CreateBankDepositInput) {
    const register = await this.getCurrent(tenantId);
    if (!register) {
      throw new BadRequestException('No open register. Open one first.');
    }

    const client = this.supabase.getClient();

    // Create deposit record
    const { data: deposit, error: depError } = await client
      .from('bank_deposits')
      .insert({
        tenant_id: tenantId,
        register_id: register.id,
        amount: input.amount,
        bank_name: input.bankName,
        account_number: input.accountNumber ?? null,
        deposit_reference: input.depositReference,
        deposit_date: input.depositDate ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (depError) throw depError;

    // Also create a transaction to deduct from cash
    await client.from('cash_transactions').insert({
      tenant_id: tenantId,
      register_id: register.id,
      transaction_type: 'deposit',
      payment_method: 'cash',
      amount: -Math.abs(input.amount),
      description: `Bank deposit: ${input.bankName} — ${input.depositReference}`,
      reference: input.depositReference,
      created_by: userId,
    });

    return deposit;
  }

  /**
   * Get daily report for a register.
   */
  async getDailyReport(tenantId: string, registerId?: string) {
    const client = this.supabase.getClient();

    // Get register (specific or current)
    let register;
    if (registerId) {
      const { data } = await client
        .from('cash_registers')
        .select('*')
        .eq('id', registerId)
        .eq('tenant_id', tenantId)
        .single();
      register = data;
    } else {
      register = await this.getCurrent(tenantId);
    }

    if (!register) throw new NotFoundException('Register not found');

    // Get all transactions
    const { data: transactions } = await client
      .from('cash_transactions')
      .select('*')
      .eq('register_id', register.id)
      .order('created_at', { ascending: true });

    // Get deposits
    const { data: deposits } = await client
      .from('bank_deposits')
      .select('*')
      .eq('register_id', register.id)
      .order('created_at', { ascending: true });

    // Group transactions by type and method
    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const tx of transactions ?? []) {
      const method = tx.payment_method as string;
      const type = tx.transaction_type as string;
      const amt = Number(tx.amount);

      byMethod[method] = (byMethod[method] ?? 0) + amt;
      byType[type] = (byType[type] ?? 0) + amt;
    }

    return {
      register,
      transactions: transactions ?? [],
      deposits: deposits ?? [],
      summary: {
        byMethod,
        byType,
        transactionCount: (transactions ?? []).length,
        depositCount: (deposits ?? []).length,
      },
    };
  }

  /**
   * Get transactions for the current register.
   */
  async getTransactions(tenantId: string) {
    const register = await this.getCurrent(tenantId);
    if (!register) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('cash_transactions')
      .select('*')
      .eq('register_id', register.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
