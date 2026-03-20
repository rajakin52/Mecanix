import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { InitiateClaimInput, AddClaimPhotoInput, PaginationInput } from '@mecanix/validators';

const VALID_CLAIM_TRANSITIONS: Record<string, string[]> = {
  initiated: ['documented'],
  documented: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'partially_approved', 'rejected'],
  approved: ['in_repair'],
  partially_approved: ['in_repair'],
  rejected: ['documented'],
  in_repair: ['completed'],
  completed: ['paid'],
};

interface ClaimFilters {
  status?: string;
  insuranceCompanyId?: string;
}

@Injectable()
export class ClaimsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput, filters: ClaimFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('insurance_claims')
      .select(
        '*, job_card:job_cards(id, job_number), insurance_company:insurance_companies(id, name), vehicle:job_cards(vehicle:vehicles(id, plate, make, model))',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.insuranceCompanyId) {
      query = query.eq('insurance_company_id', filters.insuranceCompanyId);
    }

    query = query.order('created_at', { ascending: false });

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
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('insurance_claims')
      .select(
        '*, job_card:job_cards(*, vehicle:vehicles(*), customer:customers(*)), insurance_company:insurance_companies(*)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Insurance claim not found');
    }

    // Fetch estimates with lines
    const { data: estimates } = await client
      .from('claim_estimates')
      .select('*, lines:claim_estimate_lines(*)')
      .eq('claim_id', id)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });

    // Fetch photos
    const { data: photos } = await client
      .from('claim_photos')
      .select('*')
      .eq('claim_id', id)
      .order('created_at', { ascending: true });

    // Fetch assessor actions
    const { data: assessorActions } = await client
      .from('assessor_actions')
      .select('*')
      .eq('claim_id', id)
      .order('created_at', { ascending: true });

    return {
      ...data,
      estimates: estimates ?? [],
      photos: photos ?? [],
      assessor_actions: assessorActions ?? [],
    };
  }

  async initiate(tenantId: string, userId: string, input: InitiateClaimInput) {
    const client = this.supabase.getClient();

    // Generate claim number via RPC
    const { data: claimNumber, error: rpcError } = await client.rpc(
      'generate_claim_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    // Insert claim
    const { data, error } = await client
      .from('insurance_claims')
      .insert({
        tenant_id: tenantId,
        claim_number: claimNumber,
        job_card_id: input.jobCardId,
        insurance_company_id: input.insuranceCompanyId,
        policy_number: input.policyNumber || null,
        excess_amount: input.excessAmount ?? null,
        status: 'initiated',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update job card with insurance details
    await client
      .from('job_cards')
      .update({
        is_insurance: true,
        insurance_company: input.insuranceCompanyId,
        policy_number: input.policyNumber || null,
        claim_reference: claimNumber,
      })
      .eq('id', input.jobCardId)
      .eq('tenant_id', tenantId);

    return data;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    newStatus: string,
    notes?: string,
    assessorName?: string,
  ) {
    const claim = await this.getById(tenantId, id);
    const currentStatus = claim.status as string;

    const allowed = VALID_CLAIM_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      );
    }

    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Set corresponding date fields on transition
    const now = new Date().toISOString();
    if (newStatus === 'submitted') {
      updateData['submitted_at'] = now;
    } else if (newStatus === 'under_review') {
      updateData['reviewed_at'] = now;
    } else if (newStatus === 'approved' || newStatus === 'partially_approved') {
      updateData['approved_at'] = now;
    } else if (newStatus === 'completed') {
      updateData['completed_at'] = now;
    }

    const { data, error } = await client
      .from('insurance_claims')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Insert assessor action record
    await client.from('assessor_actions').insert({
      claim_id: id,
      action: newStatus,
      from_status: currentStatus,
      to_status: newStatus,
      assessor_name: assessorName || null,
      notes: notes || null,
    });

    return data;
  }

  async addPhoto(
    tenantId: string,
    claimId: string,
    userId: string,
    input: AddClaimPhotoInput,
  ) {
    // Verify claim exists
    await this.getById(tenantId, claimId);

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('claim_photos')
      .insert({
        claim_id: claimId,
        photo_url: input.photoUrl,
        stage: input.stage,
        caption: input.caption || null,
        gps_lat: input.gpsLat ?? null,
        gps_lng: input.gpsLng ?? null,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async getPhotos(tenantId: string, claimId: string) {
    // Verify claim exists
    await this.getById(tenantId, claimId);

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('claim_photos')
      .select('*')
      .eq('claim_id', claimId)
      .order('stage', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data ?? [];
  }

  async getAssessorActions(claimId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('assessor_actions')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data ?? [];
  }
}
