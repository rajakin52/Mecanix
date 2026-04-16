import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate an AI response to a customer WhatsApp message.
   * Uses Claude to understand the customer's query and respond with
   * relevant workshop info (operating hours, job status, pricing).
   */
  async generateResponse(tenantId: string, customerPhone: string, incomingMessage: string): Promise<string> {
    if (!this.isConfigured()) {
      return 'Obrigado pela sua mensagem. Um dos nossos colaboradores irá responder em breve.';
    }

    const client = this.supabase.getClient();

    // Get workshop info
    const { data: tenant } = await client
      .from('tenants')
      .select('name, phone, email, address')
      .eq('id', tenantId)
      .single();

    // Get customer info if exists
    const { data: customer } = await client
      .from('customers')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId)
      .eq('phone', customerPhone)
      .single();

    // Get active jobs for this customer
    let activeJobs: string[] = [];
    if (customer) {
      const { data: jobs } = await client
        .from('job_cards')
        .select('job_number, status, reported_problem, vehicle:vehicles(plate, make, model)')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customer.id)
        .not('status', 'eq', 'invoiced')
        .order('created_at', { ascending: false })
        .limit(3);

      activeJobs = (jobs ?? []).map((j: Record<string, unknown>) => {
        const v = j.vehicle as Record<string, string> | null;
        return `${j.job_number}: ${v?.plate ?? ''} ${v?.make ?? ''} ${v?.model ?? ''} — ${j.status} — ${j.reported_problem}`;
      });
    }

    // Get recent chat history
    const { data: history } = await client
      .from('ai_chat_history')
      .select('direction, message')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false })
      .limit(5);

    const chatHistory = (history ?? []).reverse().map((h: Record<string, unknown>) =>
      `${h.direction === 'inbound' ? 'Customer' : 'Workshop'}: ${h.message}`
    ).join('\n');

    const systemPrompt = `You are a helpful WhatsApp assistant for ${tenant?.name ?? 'the workshop'}.
You respond in Portuguese (Angola/Mozambique style).
Keep responses short and friendly — this is WhatsApp, not email.
Workshop info: ${tenant?.name}, Tel: ${tenant?.phone}, Email: ${tenant?.email}, Address: ${tenant?.address}
${customer ? `Customer: ${customer.full_name}` : 'Unknown customer'}
${activeJobs.length > 0 ? `Active jobs:\n${activeJobs.join('\n')}` : 'No active jobs'}
If asked about job status, provide the info above.
If asked about pricing, say to contact the workshop for a quote.
If you can't answer, say a team member will respond shortly.
Never make up information about job status or pricing.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: systemPrompt,
          messages: [
            ...(chatHistory ? [{ role: 'user' as const, content: `Previous conversation:\n${chatHistory}` }] : []),
            { role: 'user' as const, content: incomingMessage },
          ],
        }),
      });

      const data = await response.json();
      const aiReply = data.content?.[0]?.text ?? 'Obrigado pela sua mensagem. Vamos responder em breve.';

      // Save both messages to history
      await client.from('ai_chat_history').insert([
        { tenant_id: tenantId, customer_phone: customerPhone, direction: 'inbound', message: incomingMessage, ai_generated: false },
        { tenant_id: tenantId, customer_phone: customerPhone, direction: 'outbound', message: aiReply, ai_generated: true },
      ]);

      return aiReply;
    } catch (error) {
      console.error('AI response error:', error);
      return 'Obrigado pela sua mensagem. Um dos nossos colaboradores irá responder em breve.';
    }
  }

  /**
   * Get AI suggestions for repair diagnosis based on reported problem
   */
  async getRepairSuggestions(reportedProblem: string, vehicleMake: string, vehicleModel: string, vehicleYear?: number): Promise<string> {
    if (!this.isConfigured()) {
      return '';
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: 'You are an experienced automotive mechanic. Provide a brief diagnostic suggestion in Portuguese. List 2-3 likely causes and recommended checks. Be concise.',
          messages: [
            { role: 'user', content: `Vehicle: ${vehicleMake} ${vehicleModel}${vehicleYear ? ` (${vehicleYear})` : ''}\nProblem: ${reportedProblem}` },
          ],
        }),
      });

      const data = await response.json();
      return data.content?.[0]?.text ?? '';
    } catch {
      return '';
    }
  }

  /**
   * AI Writing Assistant — convert tech notes to customer-friendly language
   */
  async rewriteForCustomer(techNotes: string, locale: string = 'pt'): Promise<string> {
    if (!this.isConfigured()) return techNotes;

    const langMap: Record<string, string> = { pt: 'Portuguese', en: 'English', fr: 'French' };
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are a service advisor at an automotive workshop. Rewrite the technician's notes into clear, friendly ${langMap[locale] ?? 'Portuguese'} that a non-technical customer can understand. Keep it concise. Do not add information the technician didn't mention. Output ONLY the rewritten text.`,
          messages: [{ role: 'user', content: techNotes }],
        }),
      });
      const data = await response.json();
      return data.content?.[0]?.text ?? techNotes;
    } catch { return techNotes; }
  }

  /**
   * Smart Technician Assignment — suggest best technician for a job
   */
  async suggestTechnician(tenantId: string, jobCardId: string): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured()) return null;
    const client = this.supabase.getClient();

    // Get job details
    const { data: job } = await client
      .from('job_cards')
      .select('reported_problem, symptom_codes, labels, vehicle:vehicles(make, model)')
      .eq('id', jobCardId).eq('tenant_id', tenantId).single();

    if (!job) return null;

    // Get all available technicians with their stats
    const { data: techs } = await client
      .from('technicians')
      .select('id, full_name, specializations, hourly_rate')
      .eq('tenant_id', tenantId).eq('is_active', true);

    // Get technician efficiency data
    const { data: efficiency } = await client
      .from('technician_efficiency').select('*').eq('tenant_id', tenantId);

    // Get certifications
    const { data: certs } = await client
      .from('technician_certifications').select('technician_id, name')
      .eq('tenant_id', tenantId).eq('is_active', true);

    // Get current workload (active jobs per tech)
    const { data: workload } = await client
      .from('job_cards')
      .select('primary_technician_id')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("invoiced","cancelled","received")')
      .is('deleted_at', null);

    const workloadMap: Record<string, number> = {};
    for (const j of workload ?? []) {
      const tid = j.primary_technician_id as string;
      if (tid) workloadMap[tid] = (workloadMap[tid] ?? 0) + 1;
    }

    const vehicle = job.vehicle as unknown as Record<string, string> | null;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a workshop manager assigning jobs to technicians. Based on the job requirements, technician skills, workload, efficiency, and certifications, recommend the best technician. Return ONLY a JSON object: {"technicianId": "...", "reason": "..."}`,
          messages: [{
            role: 'user',
            content: `Job: ${job.reported_problem}\nSymptoms: ${(job.symptom_codes as string[]).join(', ')}\nVehicle: ${vehicle?.make ?? ''} ${vehicle?.model ?? ''}\n\nTechnicians:\n${(techs ?? []).map((t: Record<string, unknown>) => {
              const eff = (efficiency ?? []).find((e: Record<string, unknown>) => e.technician_id === t.id);
              const techCerts = (certs ?? []).filter((c: Record<string, unknown>) => c.technician_id === t.id);
              return `- ${t.full_name} (${(t.specializations as string[])?.join(', ') || 'general'}), efficiency: ${(eff as Record<string, unknown>)?.efficiency_pct ?? '?'}%, workload: ${workloadMap[t.id as string] ?? 0} active jobs, certs: ${techCerts.map((c: Record<string, unknown>) => c.name).join(', ') || 'none'}`;
            }).join('\n')}`,
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      try {
        const match = text.match(/\{[^}]+\}/);
        if (match) return JSON.parse(match[0]);
      } catch { /* parse failed */ }
      return { suggestion: text };
    } catch { return null; }
  }

  /**
   * Predictive Maintenance — suggest upcoming maintenance based on vehicle history
   */
  async predictMaintenance(tenantId: string, vehicleId: string): Promise<string> {
    if (!this.isConfigured()) return '';
    const client = this.supabase.getClient();

    const { data: vehicle } = await client
      .from('vehicles').select('plate, make, model, year, mileage')
      .eq('id', vehicleId).eq('tenant_id', tenantId).single();

    if (!vehicle) return '';

    // Get service history
    const { data: jobs } = await client
      .from('job_cards')
      .select('job_number, reported_problem, created_at, grand_total, labour_lines:labour_lines(description), parts_lines:parts_lines(part_name)')
      .eq('vehicle_id', vehicleId).eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const history = (jobs ?? []).map((j: Record<string, unknown>) => {
      const labour = (j.labour_lines as Array<Record<string, unknown>>)?.map(l => l.description).join(', ') ?? '';
      const parts = (j.parts_lines as Array<Record<string, unknown>>)?.map(p => p.part_name).join(', ') ?? '';
      return `${j.job_number} (${new Date(j.created_at as string).toLocaleDateString()}): ${j.reported_problem}. Work: ${labour}. Parts: ${parts}`;
    }).join('\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: 'You are an experienced automotive service advisor. Based on the vehicle details and service history, predict what maintenance will be needed soon. List 3-5 items with estimated timeframe. Be practical and specific. Respond in Portuguese.',
          messages: [{
            role: 'user',
            content: `Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year ?? '?'})\nMileage: ${vehicle.mileage ?? '?'} km\nPlate: ${vehicle.plate}\n\nService History:\n${history || 'No previous service records'}`,
          }],
        }),
      });
      const data = await response.json();
      return data.content?.[0]?.text ?? '';
    } catch { return ''; }
  }

  /**
   * AI Estimate Generator — suggest labour + parts from symptoms
   */
  async generateEstimate(tenantId: string, input: {
    reportedProblem: string;
    symptomCodes: string[];
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear?: number;
  }): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) return { labour: [], parts: [] };
    const client = this.supabase.getClient();

    // Get catalog items for context
    const { data: catalog } = await client
      .from('repair_catalog')
      .select('code, name, category, estimated_hours')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('is_active', true)
      .limit(50);

    const catalogList = (catalog ?? []).map((c: Record<string, unknown>) =>
      `${c.code}: ${c.name} (${c.category}, ${c.estimated_hours}h)`
    ).join('\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: `You are an experienced service advisor creating a repair estimate. Based on the symptoms and vehicle, suggest labour items and parts needed. Use catalog codes when they match. Return ONLY a JSON object: {"labour": [{"description": "...", "hours": N, "catalogCode": "..."}], "parts": [{"name": "...", "quantity": N}], "notes": "..."}`,
          messages: [{
            role: 'user',
            content: `Vehicle: ${input.vehicleMake} ${input.vehicleModel}${input.vehicleYear ? ` (${input.vehicleYear})` : ''}\nProblem: ${input.reportedProblem}\nSymptoms: ${input.symptomCodes.join(', ')}\n\nAvailable catalog:\n${catalogList}`,
          }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch { /* parse failed */ }
      return { raw: text };
    } catch { return { labour: [], parts: [] }; }
  }

  /**
   * Get chat history for a phone number
   */
  async getChatHistory(tenantId: string, customerPhone: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_chat_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    return data ?? [];
  }
}
