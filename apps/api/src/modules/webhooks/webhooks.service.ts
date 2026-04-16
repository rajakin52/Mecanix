import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async create(
    tenantId: string,
    input: { name: string; url: string; secret?: string; events: string[] },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('webhooks')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        url: input.url,
        secret: input.secret ?? null,
        events: input.events,
        is_active: true,
        failure_count: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<{ name: string; url: string; secret: string; events: string[]; is_active: boolean }>,
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('webhooks')
      .update(input)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Webhook not found');
    return data;
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }

  async trigger(tenantId: string, event: string, payload: Record<string, unknown>) {
    const { data: webhooks } = await this.supabase
      .getClient()
      .from('webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (!webhooks || webhooks.length === 0) return { triggered: 0 };

    let triggered = 0;
    for (const webhook of webhooks) {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (webhook.secret) {
        const signature = createHmac('sha256', webhook.secret as string)
          .update(body)
          .digest('hex');
        headers['x-webhook-signature'] = signature;
      }

      let success = false;
      let statusCode: number | null = null;
      let responseBody: string | null = null;

      try {
        const res = await fetch(webhook.url as string, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        });
        statusCode = res.status;
        responseBody = await res.text();
        success = res.ok;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        responseBody = message;
        this.logger.warn(`Webhook delivery failed for ${webhook.id}: ${message}`);
      }

      // Log the result
      await this.supabase
        .getClient()
        .from('webhook_logs')
        .insert({
          tenant_id: tenantId,
          webhook_id: webhook.id,
          event,
          request_body: body,
          response_status: statusCode,
          response_body: responseBody,
          success,
        });

      if (success) {
        // Reset failure count on success
        if ((webhook.failure_count as number) > 0) {
          await this.supabase
            .getClient()
            .from('webhooks')
            .update({ failure_count: 0 })
            .eq('id', webhook.id);
        }
        triggered++;
      } else {
        const newCount = ((webhook.failure_count as number) || 0) + 1;
        const updatePayload: Record<string, unknown> = { failure_count: newCount };
        if (newCount >= 10) {
          updatePayload.is_active = false;
          this.logger.warn(`Webhook ${webhook.id} deactivated after ${newCount} consecutive failures`);
        }
        await this.supabase
          .getClient()
          .from('webhooks')
          .update(updatePayload)
          .eq('id', webhook.id);
      }
    }

    return { triggered };
  }

  async getLogs(tenantId: string, webhookId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('webhook_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
}
