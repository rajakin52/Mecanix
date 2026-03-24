import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MarketingService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('marketing_campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('marketing_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Campaign not found');
    return data;
  }

  async create(tenantId: string, userId: string, input: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('marketing_campaigns')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        message: input.message,
        target_type: input.targetType,
        target_filter: input.targetFilter ?? null,
        scheduled_at: input.scheduledAt || null,
        status: input.scheduledAt ? 'scheduled' : 'draft',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getRecipients(tenantId: string, campaignId: string): Promise<Array<{ phone: string; full_name: string }>> {
    const campaign = await this.getById(tenantId, campaignId);
    const client = this.supabase.getClient();
    const targetType = campaign.target_type as string;
    const targetFilter = campaign.target_filter as Record<string, unknown> | null;

    let query = client
      .from('customers')
      .select('phone, full_name')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null)
      .neq('phone', '');

    switch (targetType) {
      case 'inactive_customers': {
        // Get customers with no job in last 90 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const { data: activeCustomerIds } = await client
          .from('job_cards')
          .select('customer_id')
          .eq('tenant_id', tenantId)
          .gte('created_at', cutoff.toISOString());

        const activeIds = [...new Set((activeCustomerIds ?? []).map((j: Record<string, unknown>) => j.customer_id as string))];
        if (activeIds.length > 0) {
          query = query.not('id', 'in', `(${activeIds.join(',')})`);
        }
        break;
      }
      case 'corporate':
        query = query.eq('is_corporate', true);
        break;
      case 'by_vehicle_make': {
        if (targetFilter?.make) {
          const { data: vehicleCustomerIds } = await client
            .from('vehicles')
            .select('customer_id')
            .eq('tenant_id', tenantId)
            .ilike('make', String(targetFilter.make));

          const custIds = [...new Set((vehicleCustomerIds ?? []).map((v: Record<string, unknown>) => v.customer_id as string))];
          if (custIds.length > 0) {
            query = query.in('id', custIds);
          } else {
            return [];
          }
        }
        break;
      }
      case 'custom': {
        // Custom filter - for now just return all with phone
        break;
      }
      // 'all_customers' - no additional filter
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).filter((c: Record<string, unknown>) => c.phone) as Array<{ phone: string; full_name: string }>;
  }

  async send(tenantId: string, campaignId: string) {
    const campaign = await this.getById(tenantId, campaignId);

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new BadRequestException('Campaign can only be sent from draft or scheduled status');
    }

    const recipients = await this.getRecipients(tenantId, campaignId);
    const client = this.supabase.getClient();

    // Mark as sending
    await client
      .from('marketing_campaigns')
      .update({
        status: 'sending',
        total_recipients: recipients.length,
      })
      .eq('id', campaignId)
      .eq('tenant_id', tenantId);

    // In a real system this would use a queue (BullMQ), but for now
    // we'll simulate by updating counts. The actual WhatsApp sending
    // would be integrated with the WhatsApp service.
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        // The WhatsApp service would be called here:
        // await this.whatsapp.sendText(recipient.phone, campaign.message);
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    const { data, error } = await client
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
