import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GatePassService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(tenantId: string, userId: string, input: Record<string, unknown>) {
    const client = this.supabase.getClient();
    const passType = (input.passType as string) ?? 'exit';

    // Validate: final_exit only after invoicing
    if (passType === 'final_exit' && input.jobCardId) {
      const { data: job } = await client
        .from('job_cards')
        .select('status')
        .eq('id', input.jobCardId)
        .eq('tenant_id', tenantId)
        .single();

      if (job && job.status !== 'invoiced') {
        throw new BadRequestException('Final exit gate pass is only available after the job is invoiced');
      }
    }

    // Block final_exit if there's an active test_drive/sublet not returned
    if (passType === 'final_exit' && input.vehicleId) {
      const { data: activePasses } = await client
        .from('gate_passes')
        .select('id')
        .eq('vehicle_id', input.vehicleId)
        .eq('tenant_id', tenantId)
        .in('pass_type', ['test_drive', 'sublet'])
        .is('actual_return_at', null)
        .limit(1);

      if (activePasses && activePasses.length > 0) {
        throw new BadRequestException('Cannot issue final exit — vehicle has an active test drive or sublet pass not yet returned');
      }
    }

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
        pass_type: passType,
        mileage: input.mileage ?? null,
        authorized_by: userId,
        notes: input.notes || null,
        expected_return_at: input.expectedReturnAt ?? null,
        destination: input.destination ?? null,
        approved_by: userId,
        pass_status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markReturned(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('gate_passes')
      .update({
        actual_return_at: new Date().toISOString(),
        pass_status: 'returned',
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
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
