import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LoyaltyService {
  constructor(private readonly supabase: SupabaseService) {}

  async getCustomerPoints(tenantId: string, customerId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('customers')
      .select('id, full_name, loyalty_points, loyalty_tier')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customerId: data.id,
      name: data.full_name,
      points: data.loyalty_points,
      tier: data.loyalty_tier,
    };
  }

  async earnPoints(
    tenantId: string,
    userId: string,
    customerId: string,
    invoiceId: string,
    amount: number,
  ) {
    const client = this.supabase.getClient();

    // Get points-per-currency setting
    const { data: setting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'loyalty_points_per_currency')
      .single();

    const pointsPerCurrency = setting?.value ? Number(setting.value) : 1;
    const pointsToEarn = Math.floor(amount * pointsPerCurrency);

    if (pointsToEarn <= 0) {
      throw new BadRequestException('Amount too small to earn points');
    }

    // Get current balance
    const { data: customer, error: custErr } = await client
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (custErr || !customer) {
      throw new NotFoundException('Customer not found');
    }

    const newBalance = customer.loyalty_points + pointsToEarn;

    // Update customer points
    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId)
      .eq('tenant_id', tenantId);

    // Insert transaction
    const { data: tx, error: txErr } = await client
      .from('loyalty_transactions')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        transaction_type: 'earn',
        points: pointsToEarn,
        description: `Points earned from invoice`,
        reference_type: 'invoice',
        reference_id: invoiceId,
        balance_after: newBalance,
        created_by: userId,
      })
      .select()
      .single();

    if (txErr) throw txErr;

    // Update tier
    await this.updateTier(tenantId, customerId);

    return tx;
  }

  async redeemPoints(
    tenantId: string,
    userId: string,
    customerId: string,
    points: number,
    description: string,
  ) {
    const client = this.supabase.getClient();

    const { data: customer, error: custErr } = await client
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (custErr || !customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.loyalty_points < points) {
      throw new BadRequestException('Insufficient points');
    }

    const newBalance = customer.loyalty_points - points;

    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId)
      .eq('tenant_id', tenantId);

    const { data: tx, error: txErr } = await client
      .from('loyalty_transactions')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        transaction_type: 'redeem',
        points: -points,
        description,
        balance_after: newBalance,
        created_by: userId,
      })
      .select()
      .single();

    if (txErr) throw txErr;

    return tx;
  }

  async getTransactions(tenantId: string, customerId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async updateTier(tenantId: string, customerId: string) {
    const client = this.supabase.getClient();

    // Get thresholds from settings
    const { data: settings } = await client
      .from('tenant_settings')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .in('key', [
        'loyalty_silver_threshold',
        'loyalty_gold_threshold',
        'loyalty_platinum_threshold',
      ]);

    const thresholds: Record<string, number> = {
      silver: 500,
      gold: 2000,
      platinum: 5000,
    };

    for (const s of settings ?? []) {
      if (s.key === 'loyalty_silver_threshold') thresholds.silver = Number(s.value);
      if (s.key === 'loyalty_gold_threshold') thresholds.gold = Number(s.value);
      if (s.key === 'loyalty_platinum_threshold') thresholds.platinum = Number(s.value);
    }

    // Calculate total earned (not current balance)
    const { data: totalData } = await client
      .from('loyalty_transactions')
      .select('points')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'earn');

    const totalEarned = (totalData ?? []).reduce(
      (sum: number, row: { points: number }) => sum + row.points,
      0,
    );

    let tier = 'bronze';
    if (thresholds.platinum && totalEarned >= thresholds.platinum) tier = 'platinum';
    else if (thresholds.gold && totalEarned >= thresholds.gold) tier = 'gold';
    else if (thresholds.silver && totalEarned >= thresholds.silver) tier = 'silver';

    await client
      .from('customers')
      .update({ loyalty_tier: tier })
      .eq('id', customerId)
      .eq('tenant_id', tenantId);

    return tier;
  }
}
