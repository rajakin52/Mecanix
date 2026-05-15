import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { Webhook, WebhookVerificationError } from 'svix';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Resend delivery webhook.
 *
 * Resend posts JSON like:
 *   {
 *     "type": "email.delivered",
 *     "created_at": "2026-05-15T07:00:00.000Z",
 *     "data": { "email_id": "re_abc123", "from": "...", "to": ["..."], "subject": "..." }
 *   }
 *
 * We match data.email_id against soa_send_log.provider_message_id and
 * update delivery_status / delivery_event_at / delivery_error. Events
 * for emails we didn't send (anything that doesn't match a row) are
 * silently dropped — Resend retries, but the noise isn't worth surfacing.
 *
 * Signature verification: when RESEND_WEBHOOK_SECRET is set we verify
 * the svix-id / svix-timestamp / svix-signature triple against the raw
 * request body using the Svix SDK (Resend signs in the Svix format).
 * If the secret is empty we accept any well-formed payload — useful in
 * dev / before the signing secret has been generated in the dashboard.
 */
@Controller('webhook/resend')
export class ResendWebhookController {
  private readonly logger = new Logger('ResendWebhook');
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.secret = this.config.get<string>('RESEND_WEBHOOK_SECRET', '');
  }

  @Post()
  async handle(
    @Req() req: FastifyRequest & { rawBody?: string },
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Headers('svix-signature') svixSignature: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ received: boolean; matched?: boolean }> {
    if (this.secret) {
      if (!svixId || !svixTimestamp || !svixSignature) {
        this.logger.warn('Resend webhook rejected: missing svix headers');
        throw new BadRequestException('Missing svix signature headers');
      }
      if (!req.rawBody) {
        // fastify-raw-body wasn't registered or the body wasn't captured.
        // Refuse rather than verify against a re-stringified payload —
        // re-stringify can change byte-order and break the HMAC.
        this.logger.error('Resend webhook rejected: rawBody unavailable');
        throw new BadRequestException('Raw body unavailable for verification');
      }
      try {
        const wh = new Webhook(this.secret);
        wh.verify(req.rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch (err) {
        if (err instanceof WebhookVerificationError) {
          this.logger.warn(`Resend webhook signature invalid: ${err.message}`);
          throw new UnauthorizedException('Invalid webhook signature');
        }
        throw err;
      }
    }

    const eventType = String(body['type'] ?? '');
    const data = (body['data'] as Record<string, unknown>) ?? {};
    const messageId = (data['email_id'] as string) ?? '';
    const eventAt = (body['created_at'] as string) ?? new Date().toISOString();
    if (!messageId) {
      this.logger.warn(`Resend webhook missing data.email_id: ${eventType}`);
      return { received: true, matched: false };
    }

    const status = this.mapEventType(eventType);
    if (!status) {
      this.logger.log(`Resend webhook ignored type=${eventType}`);
      return { received: true, matched: false };
    }

    // Bounce reason or spam classification — Resend nests it under data.
    let error: string | null = null;
    if (status === 'bounced') {
      const bounce = data['bounce'] as Record<string, unknown> | undefined;
      error = String(bounce?.['message'] ?? bounce?.['subType'] ?? 'bounced');
    } else if (status === 'complained') {
      error = 'spam_complaint';
    }

    const { data: updated, error: updErr } = await this.supabase
      .getClient()
      .from('soa_send_log')
      .update({
        delivery_status: status,
        delivery_event_at: eventAt,
        delivery_error: error,
      })
      .eq('provider_message_id', messageId)
      .select('id')
      .maybeSingle();

    if (updErr) {
      this.logger.error(
        `Resend webhook update failed (message_id=${messageId}): ${updErr.message}`,
      );
      return { received: true, matched: false };
    }

    const matched = !!updated;
    if (!matched) {
      this.logger.log(
        `Resend webhook had no matching soa_send_log row for message_id=${messageId}`,
      );
    } else {
      this.logger.log(
        `Resend webhook → soa_send_log ${updated.id} status=${status}`,
      );
    }
    return { received: true, matched };
  }

  private mapEventType(eventType: string): 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | null {
    // Resend uses dotted names: email.delivered, email.bounced, etc.
    const tail = eventType.split('.').pop() ?? '';
    switch (tail) {
      case 'delivered':
        return 'delivered';
      case 'bounced':
        return 'bounced';
      case 'complained':
        return 'complained';
      case 'opened':
        return 'opened';
      case 'clicked':
        return 'clicked';
      // Resend also emits email.sent — we already mark sent at API call time
      // so just acknowledge without writing.
      default:
        return null;
    }
  }
}
