import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GatePassService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(tenantId: string, userId: string, input: Record<string, unknown>) {
    const client = this.supabase.getClient();

    // Generate pass number via RPC
    const { data: passNumber, error: rpcError } = await client.rpc(
      'generate_gate_pass_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    const { data, error } = await client
      .from('gate_passes')
      .insert({
        tenant_id: tenantId,
        pass_number: passNumber,
        job_card_id: input.jobCardId,
        vehicle_id: input.vehicleId,
        customer_id: input.customerId,
        pass_type: input.passType ?? 'exit',
        mileage: input.mileage ?? null,
        authorized_by: userId,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async list(tenantId: string, jobCardId?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('gate_passes')
      .select(
        '*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name), authorizer:users!gate_passes_authorized_by_fkey(id, full_name)',
      )
      .eq('tenant_id', tenantId);

    if (jobCardId) {
      query = query.eq('job_card_id', jobCardId);
    }

    query = query.order('issued_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('gate_passes')
      .select(
        '*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name), job:job_cards(id, job_number, status), authorizer:users!gate_passes_authorized_by_fkey(id, full_name)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Gate pass not found');
    }

    return data;
  }
}
