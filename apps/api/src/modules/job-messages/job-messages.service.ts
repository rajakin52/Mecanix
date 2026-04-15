import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class JobMessagesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('job_messages')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async send(tenantId: string, userId: string, input: {
    jobCardId: string;
    message: string;
    senderName: string;
    senderRole: string;
    photoUrl?: string;
  }) {
    const { data, error } = await this.supabase.getClient()
      .from('job_messages')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        sender_id: userId,
        sender_name: input.senderName,
        sender_role: input.senderRole,
        message: input.message,
        photo_url: input.photoUrl ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markRead(tenantId: string, jobCardId: string, userId: string) {
    const { error } = await this.supabase.getClient()
      .from('job_messages')
      .update({ is_read: true })
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { marked: true };
  }

  async unreadCount(tenantId: string, jobCardId: string, userId: string) {
    const { count, error } = await this.supabase.getClient()
      .from('job_messages')
      .select('id', { count: 'exact', head: true })
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { unread: count ?? 0 };
  }
}
