import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Register or update a device push token.
   */
  async registerToken(
    tenantId: string,
    userId: string,
    pushToken: string,
    platform: 'ios' | 'android' | 'web',
    appType: 'customer' | 'workshop' | 'technician',
  ) {
    const client = this.supabase.getClient();

    // Upsert — update if token exists, insert if new
    const { data, error } = await client
      .from('device_tokens')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          push_token: pushToken,
          platform,
          app_type: appType,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,push_token' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to register token: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Deactivate a device token (logout, uninstall).
   */
  async deactivateToken(userId: string, pushToken: string) {
    const client = this.supabase.getClient();

    await client
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('push_token', pushToken);
  }

  /**
   * Send push notification to a specific user (all their active devices).
   */
  async sendToUser(
    tenantId: string,
    userId: string,
    payload: PushPayload,
    entityType?: string,
    entityId?: string,
  ) {
    const client = this.supabase.getClient();

    // Get all active tokens for user
    const { data: tokens, error } = await client
      .from('device_tokens')
      .select('push_token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !tokens || tokens.length === 0) {
      this.logger.warn(`No active tokens for user ${userId}`);
      return { sent: 0 };
    }

    // Send via Expo Push API
    const messages = tokens.map((token: { push_token: string }) => ({
      to: token.push_token,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    let sentCount = 0;

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      if (response.ok) {
        sentCount = messages.length;
        this.logger.log(
          `Sent ${sentCount} push notification(s) to user ${userId}`,
        );
      } else {
        const errorBody = await response.text();
        this.logger.error(`Expo push failed: ${errorBody}`);
      }
    } catch (err) {
      this.logger.error(`Push send error: ${err}`);
    }

    // Log to history
    await client.from('notification_history').insert({
      tenant_id: tenantId,
      user_id: userId,
      channel: 'push',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      status: sentCount > 0 ? 'sent' : 'failed',
    });

    return { sent: sentCount };
  }

  /**
   * Send push to all users associated with a customer record.
   */
  async sendToCustomer(
    tenantId: string,
    customerId: string,
    payload: PushPayload,
    entityType?: string,
    entityId?: string,
  ) {
    const client = this.supabase.getClient();

    // Find user linked to this customer
    const { data: customer } = await client
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .single();

    if (!customer?.user_id) {
      this.logger.warn(`No user linked to customer ${customerId}`);
      return { sent: 0 };
    }

    return this.sendToUser(
      tenantId,
      customer.user_id,
      payload,
      entityType,
      entityId,
    );
  }
}
