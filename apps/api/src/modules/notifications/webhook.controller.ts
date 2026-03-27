import { Controller, Get, Post, Query, Body, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { FastifyReply } from 'fastify';

@Controller('webhook/whatsapp')
export class WebhookController {
  private readonly verifyToken: string;
  private readonly logger = new Logger('WhatsAppWebhook');

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', 'mecanix-webhook-2026');
  }

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() reply: FastifyReply,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      return reply.status(200).send(challenge);
    }
    this.logger.warn('WhatsApp webhook verification failed');
    return reply.status(403).send('Forbidden');
  }

  @Post()
  async receive(@Body() body: Record<string, unknown>, @Res() reply: FastifyReply) {
    // Always respond 200 quickly
    reply.status(200).send('OK');

    try {
      // Parse WhatsApp webhook payload
      const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
      const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
      const value = changes?.value as Record<string, unknown>;
      const messages = value?.messages as Array<Record<string, unknown>>;

      if (!messages || messages.length === 0) return;

      for (const msg of messages) {
        const msgType = msg.type as string;

        // Handle interactive button replies (estimate approval/rejection)
        if (msgType === 'interactive') {
          const interactive = msg.interactive as Record<string, unknown>;
          const buttonReply = interactive?.button_reply as Record<string, unknown>;
          const buttonId = buttonReply?.id as string;

          if (!buttonId) continue;

          this.logger.log(`Interactive button reply: ${buttonId}`);

          // Parse button ID: approve_{estimateId} or reject_{estimateId}
          if (buttonId.startsWith('approve_')) {
            const estimateId = buttonId.replace('approve_', '');
            await this.handleEstimateApproval(estimateId, 'whatsapp_reply');
          } else if (buttonId.startsWith('reject_')) {
            const estimateId = buttonId.replace('reject_', '');
            await this.handleEstimateRejection(estimateId, 'Rejected via WhatsApp');
          }
        }
      }
    } catch (err) {
      this.logger.error(`Webhook processing error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private async handleEstimateApproval(estimateId: string, method: string) {
    const client = this.supabase.getClient();

    try {
      // Get estimate
      const { data: estimate } = await client
        .from('estimates')
        .select('id, status, job_card_id, tenant_id')
        .eq('id', estimateId)
        .single();

      if (!estimate || (estimate.status !== 'sent' && estimate.status !== 'draft')) {
        this.logger.warn(`Estimate ${estimateId} not in approvable state: ${estimate?.status}`);
        return;
      }

      // Approve
      await client
        .from('estimates')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approval_method: method,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estimateId);

      // Transition job to in_progress
      const { data: job } = await client
        .from('job_cards')
        .select('status')
        .eq('id', estimate.job_card_id)
        .single();

      if (job && ['awaiting_approval', 'awaiting_reapproval'].includes(job.status as string)) {
        await client
          .from('job_cards')
          .update({ status: 'in_progress' })
          .eq('id', estimate.job_card_id);

        await client.from('job_status_history').insert({
          tenant_id: estimate.tenant_id,
          job_card_id: estimate.job_card_id,
          from_status: job.status,
          to_status: 'in_progress',
          notes: `Approved via WhatsApp`,
        });
      }

      this.logger.log(`Estimate ${estimateId} approved via WhatsApp`);
    } catch (err) {
      this.logger.error(`Estimate approval failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private async handleEstimateRejection(estimateId: string, reason: string) {
    const client = this.supabase.getClient();

    try {
      await client
        .from('estimates')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          approval_notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estimateId);

      this.logger.log(`Estimate ${estimateId} rejected via WhatsApp`);
    } catch (err) {
      this.logger.error(`Estimate rejection failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}
