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
