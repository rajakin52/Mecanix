import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, status?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('data_requests')
      .select('*, customer:customers(id, full_name, email, phone)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(
    tenantId: string,
    input: { customerId: string; requestType: string },
  ) {
    const validTypes = ['export', 'deletion', 'rectification'];
    if (!validTypes.includes(input.requestType)) {
      throw new BadRequestException(
        `Invalid request type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('data_requests')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId,
        request_type: input.requestType,
        status: 'pending',
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async process(tenantId: string, id: string, userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('data_requests')
      .update({
        status: 'processing',
        processed_by: userId,
        processed_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Data request not found');
    return data;
  }

  async complete(
    tenantId: string,
    id: string,
    userId: string,
    exportUrl?: string,
  ) {
    const client = this.supabase.getClient();

    // Fetch the request to determine type
    const { data: request, error: fetchError } = await client
      .from('data_requests')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException('Data request not found');
    }

    // For deletion requests: soft-delete all customer data
    if (request.request_type === 'deletion') {
      const customerId = request.customer_id as string;
      const now = new Date().toISOString();

      // Soft-delete customers record
      await client
        .from('customers')
        .update({ deleted_at: now, deleted_by: userId } as never)
        .eq('id', customerId)
        .eq('tenant_id', tenantId);

      // Soft-delete vehicles
      await client
        .from('vehicles')
        .update({ deleted_at: now, deleted_by: userId } as never)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      // Soft-delete job cards
      await client
        .from('job_cards')
        .update({ deleted_at: now, deleted_by: userId } as never)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);
    }

    // Mark request as completed
    const { data, error } = await client
      .from('data_requests')
      .update({
        status: 'completed',
        completed_by: userId,
        completed_at: new Date().toISOString(),
        export_url: exportUrl ?? null,
      } as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCustomerData(tenantId: string, customerId: string) {
    const client = this.supabase.getClient();

    // Compile all data for the customer into one JSON blob
    const [
      { data: customer },
      { data: vehicles },
      { data: jobCards },
      { data: invoices },
      { data: payments },
      { data: inspections },
    ] = await Promise.all([
      client
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .single(),
      client
        .from('vehicles')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId),
      client
        .from('job_cards')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId),
      client
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId),
      client
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId),
      client
        .from('vehicle_inspections')
        .select('*')
        .eq('tenant_id', tenantId)
        .in(
          'vehicle_id',
          (
            await client
              .from('vehicles')
              .select('id')
              .eq('customer_id', customerId)
              .eq('tenant_id', tenantId)
          ).data?.map((v) => v.id as string) ?? [],
        ),
    ]);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customer,
      vehicles: vehicles ?? [],
      job_cards: jobCards ?? [],
      invoices: invoices ?? [],
      payments: payments ?? [],
      inspections: inspections ?? [],
      exported_at: new Date().toISOString(),
    };
  }
}
