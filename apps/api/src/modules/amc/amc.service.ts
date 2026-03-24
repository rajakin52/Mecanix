import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AmcService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPackages(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('amc_packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async createPackage(tenantId: string, userId: string, input: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('amc_packages')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        duration_months: input.durationMonths ?? 12,
        price: input.price,
        services: input.services ?? [],
        max_visits: input.maxVisits ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePackage(tenantId: string, id: string, input: Record<string, unknown>) {
    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      durationMonths: 'duration_months',
      price: 'price',
      services: 'services',
      maxVisits: 'max_visits',
      isActive: 'is_active',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (input[camel] !== undefined) {
        updateData[snake] = input[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('amc_packages')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('AMC package not found');
    return data;
  }

  async listSubscriptions(tenantId: string, customerId?: string, status?: string) {
    let query = this.supabase
      .getClient()
      .from('amc_subscriptions')
      .select('*, package:amc_packages(id, name, price, max_visits), customer:customers(id, full_name, phone), vehicle:vehicles(id, plate, make, model)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async subscribe(tenantId: string, userId: string, input: Record<string, unknown>) {
    // Get the package to compute end date
    const { data: pkg, error: pkgError } = await this.supabase
      .getClient()
      .from('amc_packages')
      .select('*')
      .eq('id', input.packageId)
      .eq('tenant_id', tenantId)
      .single();

    if (pkgError || !pkg) throw new NotFoundException('AMC package not found');

    const startDate = (input as Record<string, unknown>).startDate as string | undefined ?? new Date().toISOString().split('T')[0] as string;
    const start = new Date(startDate!);
    const end = new Date(start);
    end.setMonth(end.getMonth() + (pkg.duration_months as number));
    const endDate = end.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .getClient()
      .from('amc_subscriptions')
      .insert({
        tenant_id: tenantId,
        package_id: input.packageId,
        customer_id: input.customerId,
        vehicle_id: input.vehicleId || null,
        start_date: startDate,
        end_date: endDate,
        paid_amount: input.paidAmount ?? 0,
        notes: input.notes || null,
        created_by: userId,
      })
      .select('*, package:amc_packages(id, name, price, max_visits), customer:customers(id, full_name, phone), vehicle:vehicles(id, plate, make, model)')
      .single();

    if (error) throw error;
    return data;
  }

  async recordVisit(tenantId: string, subscriptionId: string) {
    const client = this.supabase.getClient();

    const { data: sub, error: subError } = await client
      .from('amc_subscriptions')
      .select('*, package:amc_packages(max_visits)')
      .eq('id', subscriptionId)
      .eq('tenant_id', tenantId)
      .single();

    if (subError || !sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('Subscription is not active');

    const pkg = sub.package as Record<string, unknown> | null;
    const maxVisits = pkg?.max_visits as number | null;
    if (maxVisits && sub.visits_used >= maxVisits) {
      throw new BadRequestException('Maximum visits reached for this subscription');
    }

    const { data, error } = await client
      .from('amc_subscriptions')
      .update({ visits_used: sub.visits_used + 1 })
      .eq('id', subscriptionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getActiveSubscription(tenantId: string, customerId: string, vehicleId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .getClient()
      .from('amc_subscriptions')
      .select('*, package:amc_packages(id, name, price, max_visits, services)')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('vehicle_id', vehicleId)
      .eq('status', 'active')
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
