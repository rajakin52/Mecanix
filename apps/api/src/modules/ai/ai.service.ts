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
   * Analyse vehicle damage from a set of photos (base64) using Claude vision.
   * Returns findings (per-panel damage observations) and operations
   * (proposed repairs). Panel values are free-text strings matching the
   * convention already used by the manual assessment UI.
   *
   * Model: Opus 4.7 — damage assessment drives real money decisions
   * (repair vs replace, parts orders); the quality headroom matters.
   * Cost per assessment at 3 photos ≈ $0.08. Monthly cap enforced
   * at the service level in Sprint C.
   */
  async analyseDamage(input: {
    photos: Array<{ base64: string; mediaType: string; viewAngle?: string }>;
    vehicle?: { make?: string; model?: string; year?: number };
    priorDamage?: Array<{ panel: string; damageType: string; severity: number }>;
  }): Promise<{
    findings: Array<{
      panel: string;
      damageType:
        | 'dent' | 'scratch' | 'tear' | 'crack'
        | 'misalignment' | 'paint_blemish' | 'missing' | 'other';
      severity: number;
      areaPct?: number;
      confidence: number;
      notes?: string;
      photoIndex?: number;
    }>;
    operations: Array<{
      panel: string;
      operation: 'replace' | 'repair' | 'paint' | 'blend' | 'r_and_i';
      labourHours: number;
      partsCost: number;
      paintCost: number;
      oemPartNumber?: string;
      notes?: string;
    }>;
    overallConfidence: number;
    raw?: string;
  }> {
    const empty = { findings: [], operations: [], overallConfidence: 0 };
    if (!this.isConfigured() || input.photos.length === 0) return empty;

    const vehicleLine = input.vehicle
      ? `${input.vehicle.make ?? ''} ${input.vehicle.model ?? ''}${input.vehicle.year ? ` (${input.vehicle.year})` : ''}`.trim()
      : '';

    // Pre-existing damage known from prior assessments on this vehicle.
    // Dedupe by (panel, damageType) — if the same damage was re-severity'd
    // across multiple prior visits, keep the most-severe record so we
    // don't tell the model "scratch 2 on door" and "scratch 3 on door"
    // as separate pre-existing items.
    const priorByKey = new Map<string, { panel: string; damageType: string; severity: number }>();
    for (const p of input.priorDamage ?? []) {
      const key = `${p.panel}|${p.damageType}`;
      const prev = priorByKey.get(key);
      if (!prev || p.severity > prev.severity) priorByKey.set(key, p);
    }
    const priorList = [...priorByKey.values()];
    const priorDamageBlock =
      priorList.length > 0
        ? `\n\nKNOWN PRE-EXISTING DAMAGE on this vehicle (from earlier assessments):\n${priorList
            .map((p) => `- ${p.panel} — ${p.damageType}, severity ${p.severity}`)
            .join('\n')}\n\nDo NOT re-report pre-existing damage unless the photos clearly show it has worsened (higher severity) or a different damage_type has been added to the same panel. In those cases, report only the delta — a new finding only for the new damage or the additional severity.`
        : '';

    const systemPrompt = `You are an automotive damage assessor for a workshop management platform. You analyse photographs of vehicle exterior damage and return a structured assessment.

You MUST return ONLY a JSON object, no prose, no markdown fences. The shape is:
{
  "findings": [
    {
      "panel": string,              // e.g. "front_bumper", "left_front_door", "hood", "rear_right_quarter"
      "damage_type": "dent" | "scratch" | "tear" | "crack" | "misalignment" | "paint_blemish" | "missing" | "other",
      "severity": 1 | 2 | 3 | 4 | 5, // 1 = minor cosmetic; 5 = structural / unsafe
      "area_pct": number,           // 0-100, optional; approximate % of panel affected
      "confidence": number,          // 0-1, how certain you are
      "notes": string,               // brief, ≤ 120 chars
      "photo_index": number          // which photo (0-based) supports this finding
    }
  ],
  "operations": [
    {
      "panel": string,
      "operation": "replace" | "repair" | "paint" | "blend" | "r_and_i",
      "labour_hours": number,        // estimate; can be fractional
      "parts_cost": number,          // approx market cost in local currency; 0 if unknown
      "paint_cost": number,          // approx refinish material cost; 0 for non-paint operations
      "oem_part_number": string,     // optional; only if you're confident about the exact OEM part
      "notes": string                // brief justification, ≤ 120 chars
    }
  ],
  "overall_confidence": number       // 0-1
}

Rules:
- Use snake_case panel names matching common automotive conventions.
- Never invent damage not visible in the photos.
- If the photos are of poor quality, return empty arrays with overall_confidence < 0.3.
- Each operation must correspond to at least one finding on the same panel.
- Prefer "repair" + "paint" over "replace" for severity ≤ 3 on steel panels.
- Use "replace" for severity ≥ 4 or any "tear" / "crack" / "missing" on structural panels.
- Use "r_and_i" (remove and install) only when a panel must be detached to access damage elsewhere.${priorDamageBlock}`;

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    > = [];

    userContent.push({
      type: 'text',
      text: `Vehicle: ${vehicleLine || 'unknown'}\nPhotos attached in order (index 0 first).`,
    });
    for (const photo of input.photos) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 },
      });
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
          model: 'claude-opus-4-7',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: userContent }],
        }),
      });
      const data = await response.json();
      const text: string = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ...empty, raw: text };

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const findings = Array.isArray(parsed.findings) ? (parsed.findings as Array<Record<string, unknown>>) : [];
      const operations = Array.isArray(parsed.operations) ? (parsed.operations as Array<Record<string, unknown>>) : [];

      return {
        findings: findings.map((f) => ({
          panel: String(f.panel ?? 'unknown'),
          damageType: (f.damage_type as
            | 'dent' | 'scratch' | 'tear' | 'crack'
            | 'misalignment' | 'paint_blemish' | 'missing' | 'other') ?? 'other',
          severity: Math.max(1, Math.min(5, Math.round(Number(f.severity ?? 3)))),
          areaPct: f.area_pct != null ? Number(f.area_pct) : undefined,
          confidence: Math.max(0, Math.min(1, Number(f.confidence ?? 0))),
          notes: f.notes != null ? String(f.notes) : undefined,
          photoIndex: f.photo_index != null ? Number(f.photo_index) : undefined,
        })),
        operations: operations.map((o) => ({
          panel: String(o.panel ?? 'unknown'),
          operation: (o.operation as
            | 'replace' | 'repair' | 'paint' | 'blend' | 'r_and_i') ?? 'repair',
          labourHours: Math.max(0, Number(o.labour_hours ?? 0)),
          partsCost: Math.max(0, Number(o.parts_cost ?? 0)),
          paintCost: Math.max(0, Number(o.paint_cost ?? 0)),
          oemPartNumber: o.oem_part_number != null ? String(o.oem_part_number) : undefined,
          notes: o.notes != null ? String(o.notes) : undefined,
        })),
        overallConfidence: Math.max(0, Math.min(1, Number(parsed.overall_confidence ?? 0))),
      };
    } catch {
      return { ...empty };
    }
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

  /**
   * Extract expense fields from a receipt photo via Claude vision.
   * Returns best-effort fields with a confidence score; null fields
   * mean the model wasn't sure and the user must fill them in.
   */
  async ocrReceipt(input: {
    base64Data: string;
  }): Promise<{
    vendor: string | null;
    total: number | null;
    taxAmount: number | null;
    expenseDate: string | null;
    category: string | null;
    description: string | null;
    currency: string | null;
    confidence: number;
    rawText?: string;
  }> {
    const empty = {
      vendor: null,
      total: null,
      taxAmount: null,
      expenseDate: null,
      category: null,
      description: null,
      currency: null,
      confidence: 0,
    } as const;
    if (!this.isConfigured()) return { ...empty };

    // Strip data-URL prefix and capture mime type.
    const match = input.base64Data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) return { ...empty };
    const mediaType = match[1]!;
    const rawBase64 = match[2]!;

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
          system:
            'You extract structured expense data from receipt photos for an automotive workshop in Angola / Portugal. Return ONLY a JSON object (no prose) with keys: vendor (string or null), total (number, the grand total), tax_amount (number or null, the IVA portion), expense_date (YYYY-MM-DD or null), currency (ISO code or null), category (one of: fuel, parts, tools, office, utilities, rent, marketing, subscription, meals, travel, other), description (short, one line), confidence (0-1). If any field is unclear, use null for that field and lower the overall confidence.',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: rawBase64 },
                },
                {
                  type: 'text',
                  text: 'Extract the expense fields from this receipt.',
                },
              ],
            },
          ],
        }),
      });
      const data = await response.json();
      const text: string = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ...empty, rawText: text };
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        vendor: (parsed.vendor as string) ?? null,
        total: parsed.total != null ? Number(parsed.total) : null,
        taxAmount: parsed.tax_amount != null ? Number(parsed.tax_amount) : null,
        expenseDate: (parsed.expense_date as string) ?? null,
        category: (parsed.category as string) ?? null,
        description: (parsed.description as string) ?? null,
        currency: (parsed.currency as string) ?? null,
        confidence: parsed.confidence != null ? Number(parsed.confidence) : 0,
      };
    } catch {
      return { ...empty };
    }
  }
}
