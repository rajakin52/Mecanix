import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateJobCardInput, UpdateJobCardInput, PaginationInput } from '@mecanix/validators';

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ['diagnosing', 'in_progress'],
  diagnosing: ['awaiting_approval', 'in_progress', 'insurance_review'],
  awaiting_approval: ['in_progress', 'received'],
  insurance_review: ['awaiting_approval', 'in_progress'],
  in_progress: ['awaiting_parts', 'quality_check'],
  awaiting_parts: ['in_progress'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced', 'in_progress'],
  invoiced: [],
};

interface JobFilters {
  status?: string;
  customerId?: string;
  vehicleId?: string;
  technicianId?: string;
}

@Injectable()
export class JobsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput, filters: JobFilters) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('job_cards')
      .select(
        '*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (search) {
      query = query.or(
        `job_number.ilike.%${search}%,reported_problem.ilike.%${search}%`,
      );
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }
    if (filters.technicianId) {
      query = query.eq('primary_technician_id', filters.technicianId);
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
      .from('job_cards')
      .select(
        '*, vehicle:vehicles(*), customer:customers(*), primary_technician:technicians(*)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Job card not found');
    }

    // Fetch labour lines
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('*, technician:technicians(id, full_name)')
      .eq('job_card_id', id)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // Fetch parts lines
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('*')
      .eq('job_card_id', id)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // Fetch status history
    const { data: statusHistory } = await client
      .from('job_status_history')
      .select('*')
      .eq('job_card_id', id)
      .order('changed_at', { ascending: true });

    return {
      ...data,
      labour_lines: labourLines ?? [],
      parts_lines: partsLines ?? [],
      status_history: statusHistory ?? [],
    };
  }

  async create(tenantId: string, userId: string, input: CreateJobCardInput) {
    const client = this.supabase.getClient();

    // Generate job number via RPC
    const { data: jobNumber, error: rpcError } = await client.rpc(
      'generate_job_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    const { data, error } = await client
      .from('job_cards')
      .insert({
        tenant_id: tenantId,
        job_number: jobNumber,
        vehicle_id: input.vehicleId,
        customer_id: input.customerId,
        reported_problem: input.reportedProblem,
        internal_notes: input.internalNotes || null,
        primary_technician_id: input.primaryTechnicianId || null,
        status: 'received',
        is_insurance: input.isInsurance ?? false,
        is_taxable: input.isTaxable ?? true,
        requires_authorization: input.requiresAuthorization ?? false,
        labels: input.labels ?? [],
        estimated_completion: input.estimatedCompletion || null,
        parts_issuing_mode: input.partsIssuingMode ?? 'auto',
        insurance_company: input.insuranceCompany || null,
        policy_number: input.policyNumber || null,
        claim_reference: input.claimReference || null,
        excess_amount: input.excessAmount ?? null,
        customer_remarks: input.customerRemarks || null,
        estimate_footer: input.estimateFooter || null,
        labour_total: 0,
        parts_total: 0,
        tax_amount: 0,
        grand_total: 0,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert initial status history record
    await client.from('job_status_history').insert({
      tenant_id: tenantId,
      job_card_id: data.id,
      from_status: null,
      to_status: 'received',
      changed_by: userId,
      notes: null,
    });

    return data;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    userId: string,
    newStatus: string,
    notes?: string,
  ) {
    const job = await this.getById(tenantId, id);
    const currentStatus = job.status as string;

    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      );
    }

    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    };

    if (newStatus === 'invoiced') {
      updateData['date_closed'] = new Date().toISOString();
    }

    const { data, error } = await client
      .from('job_cards')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Insert status history record
    await client.from('job_status_history').insert({
      tenant_id: tenantId,
      job_card_id: id,
      from_status: currentStatus,
      to_status: newStatus,
      changed_by: userId,
      notes: notes || null,
    });

    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: Record<string, unknown>) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };

    const fieldMap: Record<string, string> = {
      reportedProblem: 'reported_problem',
      internalNotes: 'internal_notes',
      primaryTechnicianId: 'primary_technician_id',
      labels: 'labels',
      estimatedCompletion: 'estimated_completion',
      isInsurance: 'is_insurance',
      isTaxable: 'is_taxable',
      requiresAuthorization: 'requires_authorization',
      customerRemarks: 'customer_remarks',
      estimateFooter: 'estimate_footer',
      insuranceCompany: 'insurance_company',
      policyNumber: 'policy_number',
      claimReference: 'claim_reference',
      excessAmount: 'excess_amount',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (input[camel] !== undefined) {
        updateData[snake] = input[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('job_cards')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getStatusHistory(tenantId: string, jobId: string) {
    // Verify job exists
    await this.getById(tenantId, jobId);

    const { data, error } = await this.supabase
      .getClient()
      .from('job_status_history')
      .select('*')
      .eq('job_card_id', jobId)
      .order('changed_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async recalculateTotals(tenantId: string, jobId: string) {
    const client = this.supabase.getClient();

    // Sum labour lines
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('subtotal')
      .eq('job_card_id', jobId)
      .eq('tenant_id', tenantId);

    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // Sum parts lines
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('subtotal')
      .eq('job_card_id', jobId)
      .eq('tenant_id', tenantId);

    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // Get tax rate from tenant settings or default 14%
    const { data: tenantSettings } = await client
      .from('tenant_settings')
      .select('tax_rate')
      .eq('tenant_id', tenantId)
      .single();

    const taxRate = tenantSettings?.tax_rate ?? 14;

    // Get job to check if taxable
    const { data: job } = await client
      .from('job_cards')
      .select('is_taxable')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    const subtotal = labourTotal + partsTotal;
    const taxAmount = job?.is_taxable ? subtotal * (taxRate / 100) : 0;
    const grandTotal = subtotal + taxAmount;

    // Round to 2 decimal places
    const rounded = (n: number) => Math.round(n * 100) / 100;

    const { error } = await client
      .from('job_cards')
      .update({
        labour_total: rounded(labourTotal),
        parts_total: rounded(partsTotal),
        tax_amount: rounded(taxAmount),
        grand_total: rounded(grandTotal),
      })
      .eq('id', jobId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }
}
