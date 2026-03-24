import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TenantsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTenant(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tenant not found');
    }

    return data;
  }

  async updateTenant(tenantId: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new NotFoundException('Tenant not found or update failed');
    }

    return data;
  }

  async setExchangeRate(tenantId: string, rate: number) {
    if (rate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than 0');
    }

    const tenant = await this.getTenant(tenantId);

    if (!tenant.secondary_currency) {
      throw new BadRequestException('Set a secondary currency before setting an exchange rate');
    }

    // Update tenant record
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update({
        exchange_rate: rate,
        exchange_rate_updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update exchange rate');
    }

    // Insert into exchange_rates history
    await this.supabase
      .getClient()
      .from('exchange_rates')
      .insert({
        tenant_id: tenantId,
        from_currency: tenant.secondary_currency as string,
        to_currency: tenant.currency as string,
        rate,
      });

    return data;
  }

  async getExchangeRate(tenantId: string) {
    const tenant = await this.getTenant(tenantId);

    return {
      currency: tenant.currency as string,
      secondaryCurrency: (tenant.secondary_currency as string) ?? null,
      exchangeRate: tenant.exchange_rate ? Number(tenant.exchange_rate) : null,
      exchangeRateUpdatedAt: (tenant.exchange_rate_updated_at as string) ?? null,
    };
  }

  async setSecondaryCurrency(tenantId: string, currency: string | null) {
    const validCurrencies = ['USD', 'EUR', 'AOA', 'MZN', 'BRL'];

    if (currency !== null && !validCurrencies.includes(currency)) {
      throw new BadRequestException(
        `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`,
      );
    }

    const updates: Record<string, unknown> = {
      secondary_currency: currency,
    };

    // If clearing the secondary currency, also clear the exchange rate
    if (!currency) {
      updates.exchange_rate = null;
      updates.exchange_rate_updated_at = null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update secondary currency');
    }

    return data;
  }

  async getSetting(tenantId: string, key: string, defaultValue?: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', key)
      .single();

    if (error || !data) {
      return defaultValue ?? null;
    }

    return data.value as string;
  }

  async setSetting(tenantId: string, key: string, value: string): Promise<{ key: string; value: string }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, key, value },
        { onConflict: 'tenant_id,key' },
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to save setting');
    }

    return { key: data.key as string, value: data.value as string };
  }
}
